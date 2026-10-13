import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import type { Database } from './database.types'
import { requireSupabaseConfig } from './env'

/** A Supabase client bound to the current request's auth cookies. Create one per request. */
export async function createClient() {
  // Session checks compare token expiry with the current time, so they must
  // never run while Next.js prerenders a (session-specific) shell.
  await connection()
  const cookieStore = await cookies()
  const { url, key } = requireSupabaseConfig()

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't write cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore there.
        }
      },
    },
  })
}
