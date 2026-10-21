import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameOriginRequest, parseQueuedEntry } from '@/lib/offline-sync'
import { createClient } from '@/lib/supabase/server'
import { clearNoSpendMark } from '@/lib/transaction-effects'
import { validateTransaction } from '@/lib/validation'

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

function reply(status: number, body: { ok: boolean; error?: string; message?: string; duplicate?: boolean }) {
  return NextResponse.json(body, { status })
}

/**
 * Receives one entry the phone saved while offline (posted by public/sw.js once the network is back).
 * The entry carries its own id, so sending it twice stores it once: the second insert hits the
 * primary key and is answered as a success. Status codes tell the service worker what to do:
 * 200 drop it from the queue · 401 keep it until the user signs in · 409 it belongs to another
 * account · 422 it can never be stored (show the reason) · 5xx try again later.
 */
export async function POST(request: NextRequest) {
  const sameOrigin = isSameOriginRequest({
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    secFetchSite: request.headers.get('sec-fetch-site'),
  })
  if (!sameOrigin) return reply(403, { ok: false, error: 'forbidden' })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return reply(422, { ok: false, error: 'invalid', message: 'Dữ liệu không hợp lệ.' })
  }
  const parsed = parseQueuedEntry(raw)
  if (!parsed.ok) return reply(422, { ok: false, error: 'invalid', message: parsed.error })
  const { entry } = parsed

  const values = validateTransaction(entry.body)
  if (!values.ok) {
    const message = Object.values(values.fieldErrors)[0] ?? 'Dữ liệu không hợp lệ.'
    return reply(422, { ok: false, error: 'invalid', message })
  }

  // Same check as getSession(), but answered with a status instead of a redirect to /login.
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (isAuthRetryableFetchError(error)) return reply(503, { ok: false, error: 'auth_unavailable' })
  if (error || !data.user) return reply(401, { ok: false, error: 'signed_out', message: 'Cần đăng nhập để gửi.' })
  if (data.user.id !== entry.userId) {
    return reply(409, { ok: false, error: 'other_account', message: 'Khoản này được ghi bằng tài khoản khác.' })
  }

  const { error: insertError } = await supabase.from('transactions').insert({ ...values.value, id: entry.id, user_id: data.user.id })
  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) return reply(200, { ok: true, duplicate: true })
    if (insertError.code === FOREIGN_KEY_VIOLATION) {
      return reply(422, { ok: false, error: 'item', message: 'Khoản mục không còn trong danh mục. Hãy ghi lại trong app.' })
    }
    console.error('offline entry insert failed', insertError)
    return reply(500, { ok: false, error: 'insert_failed' })
  }

  // Same side effect as saving in the app: an expense means the day was not a "no spend" day.
  if (values.value.kind === 'expense') await clearNoSpendMark(supabase, values.value.occurred_on)
  return reply(200, { ok: true })
}
