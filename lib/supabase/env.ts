/**
 * Supabase connection settings. The publishable key is safe to expose — every
 * table is protected by Row Level Security (see supabase/schema.sql).
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted for projects that still use the
 * legacy key name (for example when set by the Vercel ↔ Supabase integration).
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

export function requireSupabaseConfig(): { url: string; key: string } {
  const config = getSupabaseConfig()
  if (!config) {
    throw new Error(
      'Chưa cấu hình Supabase: thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (xem README).',
    )
  }
  return config
}
