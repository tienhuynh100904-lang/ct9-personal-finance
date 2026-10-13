import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from './supabase/server'

export type SessionUser = { id: string; email: string | null }

/**
 * Data Access Layer entry point: verifies the session JWT and returns a
 * request-scoped Supabase client together with the signed-in user.
 * Redirects to /login when there is no valid session. Every data read and
 * every Server Action goes through here — the proxy alone is not trusted.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) redirect('/login')

  const user: SessionUser = {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  }
  return { supabase, user }
})
