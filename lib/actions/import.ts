'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { MAX_IMPORT_ROWS } from '../csv-import'
import type { Category, Kind } from '../finance'
import { isMissingTable } from '../supabase/errors'
import { validateTransaction } from '../validation'
import { isUuid, type ActionResult } from './result'

export type ImportRow = { kind: Kind; item: string; category: Category; amount: number; occurred_on: string; note: string | null }

const PAGE_SIZE = 1000

const keyOf = (r: { kind: string; item: string; category: string; amount: number; occurred_on: string }) =>
  `${r.kind}|${r.item}|${r.category}|${r.amount}|${r.occurred_on}`

/**
 * Imports transactions read from a CSV. Every row is validated again here (the browser's check is
 * only for feedback). A row identical to one already saved (same kind, item, category, amount and
 * day) is skipped, so importing the same export twice adds nothing; identical rows inside the file
 * count one by one, so two real coffees on one day survive. All new rows go in with one insert:
 * either everything is added or nothing is.
 *
 * With `dryRun`, nothing is written: it only reports which rows (by index) are duplicates, for the preview.
 */
export async function importTransactions(input: {
  rows: ImportRow[]
  dryRun?: boolean
}): Promise<ActionResult & { duplicates?: number[]; inserted?: number; ids?: string[] }> {
  const { supabase, user } = await getSession()
  const rows = Array.isArray(input?.rows) ? input.rows : []
  if (rows.length === 0) return { ok: false, error: 'Không có dòng nào để nhập.' }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng. Hãy chia file nhỏ hơn.` }

  const clean: ImportRow[] = []
  for (const row of rows) {
    const parsed = validateTransaction(row)
    if (!parsed.ok) return { ok: false, error: 'Có dòng không hợp lệ. Hãy chọn lại file và xem phần xem trước.' }
    clean.push(parsed.value)
  }

  // What is already saved in the span of days the file covers.
  let from = clean[0].occurred_on
  let to = from
  for (const r of clean) {
    if (r.occurred_on < from) from = r.occurred_on
    if (r.occurred_on > to) to = r.occurred_on
  }
  const existing = new Map<string, number>()
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('kind, item, category, amount, occurred_on')
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('importTransactions (read) failed', error)
      return { ok: false, error: 'Không kiểm tra được dữ liệu hiện có. Vui lòng thử lại.' }
    }
    for (const r of data) existing.set(keyOf(r), (existing.get(keyOf(r)) ?? 0) + 1)
    if (data.length < PAGE_SIZE) break
  }

  const duplicates: number[] = []
  const fresh: ImportRow[] = []
  clean.forEach((row, index) => {
    const key = keyOf(row)
    const left = existing.get(key) ?? 0
    if (left > 0) {
      existing.set(key, left - 1)
      duplicates.push(index)
    } else {
      fresh.push(row)
    }
  })

  if (input.dryRun) return { ok: true, duplicates }
  if (fresh.length === 0) return { ok: true, duplicates, inserted: 0, ids: [] }

  const { data, error } = await supabase
    .from('transactions')
    .insert(fresh.map((r) => ({ ...r, user_id: user.id })))
    .select('id')
  if (error) {
    console.error('importTransactions failed', error)
    return { ok: false, error: 'Không nhập được. Chưa có dòng nào được thêm. Vui lòng thử lại.' }
  }

  // Expenses on these days mean the days were not "Không chi tiêu" days (best effort).
  const spendDays = [...new Set(fresh.filter((r) => r.kind === 'expense').map((r) => r.occurred_on))]
  if (spendDays.length > 0) {
    const { error: markError } = await supabase.from('day_marks').delete().in('day', spendDays)
    if (markError && !isMissingTable(markError)) console.error('importTransactions: clearing day marks failed', markError)
  }

  refresh()
  return { ok: true, duplicates, inserted: data.length, ids: data.map((r) => r.id) }
}

/** "Hoàn tác" for an import: removes exactly the transactions it added. */
export async function undoImport(ids: string[]): Promise<ActionResult & { removed?: number }> {
  const { supabase } = await getSession()
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IMPORT_ROWS || !ids.every(isUuid)) {
    return { ok: false, error: 'Danh sách giao dịch không hợp lệ.' }
  }
  const { data, error } = await supabase.from('transactions').delete().in('id', ids).select('id')
  if (error) {
    console.error('undoImport failed', error)
    return { ok: false, error: 'Không hoàn tác được. Vui lòng thử lại.' }
  }
  refresh()
  return { ok: true, removed: data.length }
}
