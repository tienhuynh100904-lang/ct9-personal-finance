import 'server-only'

import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from './supabase/server'

export type SessionUser = { id: string; email: string | null }

/**
 * Data Access Layer entry point: checks the session with Supabase Auth and returns a
 * request-scoped Supabase client together with the signed-in user.
 * Redirects to /login when there is no valid session. Every data read and
 * every Server Action goes through here — the proxy alone is not trusted.
 *
 * This asks the Auth server (`getUser`) instead of only verifying the JWT (`getClaims`): a JWT stays
 * valid until it expires, so a session revoked by a password change on another device, or a
 * banned/deleted account, would keep working for up to an hour.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  // An outage is not a sign-out. Sending the user to /login would not help (the proxy still sees a
  // valid token and sends them back), so fail the request and let the caller show an error.
  if (isAuthRetryableFetchError(error)) throw error
  if (error || !data.user) redirect('/login')

  const user: SessionUser = { id: data.user.id, email: data.user.email ?? null }
  return { supabase, user }
})
