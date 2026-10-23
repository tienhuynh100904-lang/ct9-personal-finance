'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { isMissingColumn } from '../supabase/errors'
import type { BudgetAlert } from '../finance'
import { budgetCrossing, clearNoSpendMark } from '../transaction-effects'
import { validateTransaction, type FieldErrors, type TransactionInput } from '../validation'
import { isUuid, type ActionResult } from './result'

const FOREIGN_KEY_VIOLATION = '23503'

export async function saveTransaction(
  input: TransactionInput,
): Promise<
  ActionResult<FieldErrors<TransactionInput>> & {
    id?: string
    clearedMark?: boolean
    /** Set when this entry just pushed its spending group past 80% or 100% of the month's plan. */
    budgetAlert?: BudgetAlert | null
  }
> {
  const { supabase, user } = await getSession()

  const parsed = validateTransaction(input)
  if (!parsed.ok) {
    return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }
  }

  const id = input?.id
  if (id !== undefined && !isUuid(id)) return { ok: false, error: 'Giao dịch không hợp lệ.' }

  // The row before an edit, so the budget check counts only the difference.
  const previous = id
    ? (await supabase.from('transactions').select('kind, category, amount, occurred_on').eq('id', id).maybeSingle()).data
    : null

  // Income and savings cannot be marked "Muốn giảm" (a database check), so an edit that turns a marked
  // expense into one of those clears the mark first. Without the column this fails with "missing
  // column", which is fine: there is nothing to clear.
  if (id && (parsed.value.kind === 'income' || parsed.value.category === 'saving')) {
    await supabase.from('transactions').update({ cut_candidate: false }).eq('id', id)
  }

  const { data, error } = id
    ? await supabase.from('transactions').update(parsed.value).eq('id', id).select('id')
    : await supabase
        .from('transactions')
        .insert({ ...parsed.value, user_id: user.id })
        .select('id')

  if (error) {
    // The item is gone, or is of the other kind (thu/chi): the form should offer the list again.
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: 'Khoản mục không còn trong danh mục. Hãy chọn lại.', fieldErrors: { item_id: 'Chọn khoản mục.' } }
    }
    console.error('saveTransaction failed', error)
    return { ok: false, error: 'Không lưu được giao dịch. Vui lòng thử lại.' }
  }
  if (!data.length) return { ok: false, error: 'Không tìm thấy giao dịch cần sửa.' }

  // An expense means the day was not a "no spend" day; tell the caller so "Hoàn tác" can restore the mark.
  const [clearedMark, budgetAlert] = await Promise.all([
    parsed.value.kind === 'expense' ? clearNoSpendMark(supabase, parsed.value.occurred_on) : false,
    budgetCrossing(supabase, parsed.value, previous),
  ])

  refresh()
  return { ok: true, id: data[0].id, clearedMark, budgetAlert }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Giao dịch không hợp lệ.' }

  const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('id')
  if (error) {
    console.error('deleteTransaction failed', error)
    return { ok: false, error: 'Không xoá được giao dịch. Vui lòng thử lại.' }
  }
  if (!data.length) return { ok: false, error: 'Giao dịch không còn tồn tại.' }

  refresh()
  return { ok: true }
}

/** Marks or unmarks expenses as "Muốn giảm" (the month-end review). Savings and income are never marked. */
export async function setCutCandidates(ids: string[], value: boolean): Promise<ActionResult & { updated?: number }> {
  const { supabase } = await getSession()
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every(isUuid) || typeof value !== 'boolean') {
    return { ok: false, error: 'Giao dịch không hợp lệ.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ cut_candidate: value })
    .in('id', ids)
    .eq('kind', 'expense')
    .neq('category', 'saving')
    .select('id')
  if (error) {
    if (isMissingColumn(error)) return { ok: false, error: 'Hãy chạy lại toàn bộ supabase/schema.sql trong Supabase để dùng tính năng này.' }
    console.error('setCutCandidates failed', error)
    return { ok: false, error: 'Không cập nhật được. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true, updated: data.length }
}
