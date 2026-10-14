'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '../auth'
import { clearPasswordReset, hasPasswordReset } from '../password-reset'
import { createClient } from '../supabase/server'
import { getSupabaseConfig } from '../supabase/env'
import type { ActionResult } from './result'

export type LoginState = { error: string | null; email: string }

const MIN_PASSWORD_LENGTH = 8

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Email hoặc mật khẩu không đúng.'
    case 'email_not_confirmed':
      return 'Email chưa được xác nhận. Hãy xác nhận tài khoản trong Supabase (Authentication → Users).'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.'
    case 'user_banned':
      return 'Tài khoản đang bị khoá.'
    default:
      return 'Không đăng nhập được. Vui lòng thử lại.'
  }
}

/** Only same-site paths are allowed as the post-login destination (no open redirects). */
function safeNextPath(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && next !== '/login'
    ? next
    : '/'
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!getSupabaseConfig()) {
    return { email, error: 'Ứng dụng chưa được cấu hình Supabase (xem README).' }
  }
  if (!email || !password) {
    return { email, error: 'Vui lòng nhập email và mật khẩu.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { email, error: authErrorMessage(error.code) }

  redirect(safeNextPath(formData.get('next')))
}

export async function signOut(): Promise<void> {
  if (getSupabaseConfig()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect('/login')
}

export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<ActionResult<{ currentPassword?: string; newPassword?: string }>> {
  const { supabase, user } = await getSession()
  const currentPassword = typeof input?.currentPassword === 'string' ? input.currentPassword : ''
  const newPassword = typeof input?.newPassword === 'string' ? input.newPassword : ''

  if (!currentPassword) {
    return { ok: false, error: 'Nhập mật khẩu hiện tại.', fieldErrors: { currentPassword: 'Bắt buộc.' } }
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      fieldErrors: { newPassword: `Ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` },
    }
  }
  if (!user.email) return { ok: false, error: 'Tài khoản không có email.' }

  // Re-authenticate first so a forgotten open session can't be used to take over the account.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) {
    // Only a bad password is the user's mistake; a rate limit or an outage must not read as "wrong password".
    if (verifyError.code !== 'invalid_credentials') {
      console.error('changePassword: checking the current password failed', verifyError)
      const rateLimited = verifyError.code?.startsWith('over_')
      return {
        ok: false,
        error: rateLimited ? authErrorMessage(verifyError.code) : 'Không kiểm tra được mật khẩu hiện tại. Vui lòng thử lại.',
      }
    }
    return {
      ok: false,
      error: 'Mật khẩu hiện tại không đúng.',
      fieldErrors: { currentPassword: 'Không đúng.' },
    }
  }

  // The project may require the current password again on the update itself (Supabase "Require current password
  // when updating"); without it the update fails with "Current password required when setting new password".
  const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword })
  if (error) return passwordUpdateFailure(error, 'changePassword')

  // Other devices keep their refresh tokens after a password change: revoke them so a lost phone loses access.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
  if (signOutError) console.error('changePassword: signing out other devices failed', signOutError)
  return { ok: true, message: 'Đã đổi mật khẩu. Các thiết bị khác sẽ phải đăng nhập lại.' }
}

function passwordUpdateFailure(
  error: { code?: string },
  source: string,
): { ok: false; error: string; fieldErrors?: { newPassword?: string } } {
  if (error.code === 'same_password') {
    return { ok: false, error: 'Mật khẩu mới phải khác mật khẩu hiện tại.', fieldErrors: { newPassword: 'Trùng mật khẩu cũ.' } }
  }
  if (error.code === 'weak_password') {
    return { ok: false, error: 'Mật khẩu mới quá yếu, hãy dùng mật khẩu dài và khó đoán hơn.', fieldErrors: { newPassword: 'Quá yếu.' } }
  }
  console.error(`${source} failed`, error)
  return { ok: false, error: 'Không đổi được mật khẩu. Vui lòng thử lại.' }
}

export type ResetRequestState = {
  error: string | null
  email: string
  /** Set (to the server time in ms) once a link has been sent. */
  sentAt: number | null
}

/**
 * Step 1 of "Quên mật khẩu": emails a reset link. The answer is the same whether or not the
 * address has an account, so the form cannot be used to find out which emails are registered.
 */
export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!getSupabaseConfig()) {
    return { email, sentAt: null, error: 'Ứng dụng chưa được cấu hình Supabase (xem README).' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email, sentAt: null, error: 'Nhập địa chỉ email hợp lệ.' }
  }

  // Used only by Supabase's default (`code`) email template; it must be in the redirect allow-list.
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const proto = requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: host ? `${proto}://${host}/auth/confirm` : undefined,
  })
  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
      return { email, sentAt: null, error: 'Bạn vừa yêu cầu gần đây. Vui lòng đợi một phút rồi thử lại.' }
    }
    console.error('requestPasswordReset failed', error)
    return { email, sentAt: null, error: 'Không gửi được email. Vui lòng thử lại sau.' }
  }
  return { email, sentAt: Date.now(), error: null }
}

/**
 * Step 3 of "Quên mật khẩu": sets the new password. Allowed only right after a reset link was
 * opened (see lib/password-reset.ts). Other devices are signed out so a lost phone loses access.
 */
export async function resetPassword(input: {
  newPassword: string
}): Promise<
  | ActionResult<{ newPassword?: string }>
  /** The reset window ran out (or never opened): the client sends the user back to ask again. */
  | { ok: false; error: string; expired: true }
> {
  if (!(await hasPasswordReset())) {
    return { ok: false, expired: true, error: 'Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu liên kết mới.' }
  }
  const { supabase } = await getSession()
  const newPassword = typeof input?.newPassword === 'string' ? input.newPassword : ''
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      fieldErrors: { newPassword: `Ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` },
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return passwordUpdateFailure(error, 'resetPassword')

  await supabase.auth.signOut({ scope: 'others' })
  await clearPasswordReset()
  return { ok: true, message: 'Đã đặt lại mật khẩu.' }
}
