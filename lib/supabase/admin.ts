import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { requireSupabaseConfig } from './env'

/**
 * A Supabase client that BYPASSES Row Level Security (service role / secret key). Only for jobs
 * that run without a signed-in user, such as the reminder cron route. Never import it from a page,
 * a Server Action reachable by users, or a client component, and never expose the key
 * (`SUPABASE_SERVICE_ROLE_KEY` has no NEXT_PUBLIC_ prefix on purpose).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY (xem docs/nhac-ghi-chep.md).')
  return createClient<Database>(requireSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
