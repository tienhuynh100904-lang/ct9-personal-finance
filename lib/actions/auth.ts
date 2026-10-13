'use server'

import { redirect } from 'next/navigation'
import { getSession } from '../auth'
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
    return {
      ok: false,
      error: 'Mật khẩu hiện tại không đúng.',
      fieldErrors: { currentPassword: 'Không đúng.' },
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    if (error.code === 'same_password') {
      return { ok: false, error: 'Mật khẩu mới phải khác mật khẩu hiện tại.', fieldErrors: { newPassword: 'Trùng mật khẩu cũ.' } }
    }
    if (error.code === 'weak_password') {
      return { ok: false, error: 'Mật khẩu mới quá yếu, hãy dùng mật khẩu dài và khó đoán hơn.', fieldErrors: { newPassword: 'Quá yếu.' } }
    }
    console.error('changePassword failed', error)
    return { ok: false, error: 'Không đổi được mật khẩu. Vui lòng thử lại.' }
  }
  return { ok: true, message: 'Đã đổi mật khẩu.' }
}
