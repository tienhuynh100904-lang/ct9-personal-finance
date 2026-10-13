import 'server-only'

import { cookies } from 'next/headers'

/**
 * Proof that the visitor just opened a password-reset link. /auth/confirm sets it after the link
 * is verified; /reset-password and `resetPassword` require it, so an ordinary signed-in session
 * can never skip "current password" by walking to the reset page.
 */
const RESET_COOKIE = 'ct9_pw_reset'
const RESET_WINDOW_SECONDS = 15 * 60

export async function grantPasswordReset(): Promise<void> {
  const store = await cookies()
  store.set(RESET_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: RESET_WINDOW_SECONDS,
  })
}

export async function hasPasswordReset(): Promise<boolean> {
  return (await cookies()).has(RESET_COOKIE)
}

export async function clearPasswordReset(): Promise<void> {
  ;(await cookies()).delete(RESET_COOKIE)
}
