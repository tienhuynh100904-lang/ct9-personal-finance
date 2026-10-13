import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { grantPasswordReset } from '@/lib/password-reset'
import { getSupabaseConfig } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Landing point of the link in the "Reset password" email. Two link shapes are accepted:
 * `?token_hash=…&type=recovery` (the email template documented in the README; works even when
 * the link is opened on another device than the one that asked for it) and `?code=…` (Supabase's
 * default template). A verified link opens a short reset window and goes to /reset-password;
 * anything else goes back to /forgot-password with an explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  const fail = () => NextResponse.redirect(new URL('/forgot-password?error=expired', request.url))
  if (!getSupabaseConfig()) return fail()

  const supabase = await createClient()
  let error: unknown = new Error('missing link parameters')

  if (tokenHash && type === 'recovery') {
    ;({ error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash }))
  } else if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  }
  if (error) return fail()

  await grantPasswordReset()
  return NextResponse.redirect(new URL('/reset-password', request.url))
}
