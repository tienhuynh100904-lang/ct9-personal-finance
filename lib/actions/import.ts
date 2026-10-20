'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { MAX_IMPORT_ROWS } from '../csv-import'
import type { Category, Kind } from '../finance'
import { itemKey, TRANSACTION_ITEM_JOIN } from '../items'
import { isMissingTable } from '../supabase/errors'
import { validateImportRow, type ImportRowValues } from '../validation'
import { isUuid, type ActionResult } from './result'

export type ImportRow = { kind: Kind; item: string; category: Category; amount: number; occurred_on: string; note: string | null }

const PAGE_SIZE = 1000

const itemSlot = (kind: string, item: string) => `${kind}|${itemKey(item)}`

/** Two rows are the same entry when kind, item, category, amount and day match (item names compared like the item list does). */
const keyOf = (r: { kind: string; item: string; category: string; amount: number; occurred_on: string }) =>
  `${itemSlot(r.kind, r.item)}|${r.category}|${r.amount}|${r.occurred_on}`

/**
 * Imports transactions read from a CSV. Every row is validated again here (the browser's check is
 * only for feedback). A row's item is found in the user's list by name (case and spacing ignored);
 * a name that is not in the list yet becomes a new item, with the row's category as its default.
 * A row identical to one already saved (same kind, item, category, amount and day) is skipped, so
 * importing the same export twice adds nothing; identical rows inside the file count one by one, so
 * two real coffees on one day survive. New items and rows go in as one step as far as possible:
 * if the rows cannot be saved, the items created for them are removed again.
 *
 * With `dryRun`, nothing is written: it only reports which rows (by index) are duplicates and which
 * item names would be created, for the preview.
 */
export async function importTransactions(input: {
  rows: ImportRow[]
  dryRun?: boolean
}): Promise<ActionResult & { duplicates?: number[]; inserted?: number; ids?: string[]; newItems?: string[] }> {
  const { supabase, user } = await getSession()
  const rows = Array.isArray(input?.rows) ? input.rows : []
  if (rows.length === 0) return { ok: false, error: 'Không có dòng nào để nhập.' }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng. Hãy chia file nhỏ hơn.` }

  const clean: ImportRowValues[] = []
  for (const row of rows) {
    const parsed = validateImportRow(row)
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
      .select(`kind, category, amount, occurred_on, ${TRANSACTION_ITEM_JOIN}`)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('importTransactions (read) failed', error)
      return { ok: false, error: 'Không kiểm tra được dữ liệu hiện có. Vui lòng thử lại.' }
    }
    for (const r of data as unknown as { kind: string; category: string; amount: number; occurred_on: string; items: { name: string } | null }[]) {
      const key = keyOf({ ...r, item: r.items?.name ?? '' })
      existing.set(key, (existing.get(key) ?? 0) + 1)
    }
    if (data.length < PAGE_SIZE) break
  }

  const duplicates: number[] = []
  const fresh: ImportRowValues[] = []
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

  // The user's items, to match the rows' names against.
  const { data: itemRows, error: itemsError } = await supabase.from('items').select('id, kind, name, archived_at')
  if (itemsError) {
    console.error('importTransactions (items) failed', itemsError)
    return { ok: false, error: 'Không đọc được danh mục khoản mục. Vui lòng thử lại.' }
  }
  const itemIds = new Map<string, string>()
  const archivedIds = new Set<string>()
  for (const i of itemRows) {
    itemIds.set(itemSlot(i.kind, i.name), i.id)
    if (i.archived_at) archivedIds.add(i.id)
  }

  // Names not in the list yet: the first spelling in the file wins, the first row's category becomes the default.
  const missing = new Map<string, { kind: Kind; name: string; default_category: Category }>()
  for (const r of fresh) {
    const slot = itemSlot(r.kind, r.item)
    if (!itemIds.has(slot) && !missing.has(slot)) missing.set(slot, { kind: r.kind, name: r.item, default_category: r.category })
  }
  const newItems = [...missing.values()].map((m) => m.name)

  if (input.dryRun) return { ok: true, duplicates, newItems }
  if (fresh.length === 0) return { ok: true, duplicates, inserted: 0, ids: [], newItems: [] }

  let createdIds: string[] = []
  if (missing.size > 0) {
    const { data, error } = await supabase
      .from('items')
      .insert([...missing.values()].map((m) => ({ ...m, user_id: user.id })))
      .select('id, kind, name')
    if (error) {
      console.error('importTransactions (create items) failed', error)
      return { ok: false, error: 'Không tạo được khoản mục mới. Chưa có dòng nào được thêm. Vui lòng thử lại.' }
    }
    for (const i of data) itemIds.set(itemSlot(i.kind, i.name), i.id)
    createdIds = data.map((i) => i.id)
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(
      fresh.map((r) => ({
        user_id: user.id,
        kind: r.kind,
        item_id: itemIds.get(itemSlot(r.kind, r.item)) as string,
        category: r.category,
        amount: r.amount,
        occurred_on: r.occurred_on,
        note: r.note,
      })),
    )
    .select('id')
  if (error) {
    console.error('importTransactions failed', error)
    if (createdIds.length > 0) {
      const { error: cleanupError } = await supabase.from('items').delete().in('id', createdIds)
      if (cleanupError) console.error('importTransactions: removing the new items failed', cleanupError)
    }
    return { ok: false, error: 'Không nhập được. Chưa có dòng nào được thêm. Vui lòng thử lại.' }
  }

  // An item hidden earlier is back in use (best effort).
  const revived = [...new Set(fresh.map((r) => itemIds.get(itemSlot(r.kind, r.item)) as string))].filter((id) => archivedIds.has(id))
  if (revived.length > 0) {
    const { error: reviveError } = await supabase.from('items').update({ archived_at: null }).in('id', revived)
    if (reviveError) console.error('importTransactions: showing items again failed', reviveError)
  }

  // Expenses on these days mean the days were not "Không chi tiêu" days (best effort).
  const spendDays = [...new Set(fresh.filter((r) => r.kind === 'expense').map((r) => r.occurred_on))]
  if (spendDays.length > 0) {
    const { error: markError } = await supabase.from('day_marks').delete().in('day', spendDays)
    if (markError && !isMissingTable(markError)) console.error('importTransactions: clearing day marks failed', markError)
  }

  refresh()
  return { ok: true, duplicates, inserted: data.length, ids: data.map((r) => r.id), newItems }
}

/** "Hoàn tác" for an import: removes exactly the transactions it added. Items created for it stay in the list. */
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
