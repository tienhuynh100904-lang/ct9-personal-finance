'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { todayISO } from '../dates'
import type { BudgetAlert } from '../finance'
import { MAX_AMOUNT, validateRecurring, type FieldErrors, type RecurringInput } from '../validation'
import { confirmDate, dueDate } from '../recurring'
import { isMissingTable } from '../supabase/errors'
import { budgetCrossing, clearNoSpendMark } from '../transaction-effects'
import { isUuid, type ActionResult } from './result'

const MISSING_TABLE_MESSAGE = 'Chưa bật tính năng giao dịch định kỳ. Hãy chạy lại supabase/schema.sql trong Supabase.'

function failure(error: { code?: string } | null, source: string, message: string): { ok: false; error: string } {
  if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
  console.error(`${source} failed`, error)
  return { ok: false, error: message }
}

/** Only the current month (Vietnam time) can be confirmed or skipped. */
function isCurrentMonth(year: unknown, month: unknown): boolean {
  const today = todayISO()
  return year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7))
}

export async function saveRecurring(input: RecurringInput): Promise<ActionResult<FieldErrors<RecurringInput>>> {
  const { supabase, user } = await getSession()
  const parsed = validateRecurring(input)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const id = input?.id
  if (id !== undefined && !isUuid(id)) return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }

  const { data, error } = id
    ? await supabase.from('recurring_transactions').update(parsed.value).eq('id', id).select('id')
    : await supabase
        .from('recurring_transactions')
        .insert({ ...parsed.value, user_id: user.id })
        .select('id')
  if (error?.code === '23503') {
    return { ok: false, error: 'Khoản mục không còn trong danh mục. Hãy chọn lại.', fieldErrors: { item_id: 'Chọn khoản mục.' } }
  }
  if (error) return failure(error, 'saveRecurring', 'Không lưu được khoản định kỳ. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Không tìm thấy khoản định kỳ cần sửa.' }

  refresh()
  return { ok: true }
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id) || typeof active !== 'boolean') return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }
  const { data, error } = await supabase.from('recurring_transactions').update({ active }).eq('id', id).select('id')
  if (error) return failure(error, 'setRecurringActive', 'Không cập nhật được. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Khoản định kỳ không còn tồn tại.' }
  refresh()
  return { ok: true }
}

/** Deletes the rule. Transactions it already created stay: they are real entries. */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }
  const { data, error } = await supabase.from('recurring_transactions').delete().eq('id', id).select('id')
  if (error) return failure(error, 'deleteRecurring', 'Không xoá được khoản định kỳ. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Khoản định kỳ không còn tồn tại.' }
  refresh()
  return { ok: true }
}

/**
 * Confirms this month's entry for a rule: creates the transaction (with the amount the user
 * confirmed, e.g. this month's electricity bill) dated on the due day, or today if it is early.
 */
export async function confirmRecurring(input: {
  id: string
  year: number
  month: number
  amount?: number
}): Promise<ActionResult & { transactionId?: string; clearedMark?: boolean; budgetAlert?: BudgetAlert | null }> {
  const { supabase } = await getSession()
  const { id, year, month, amount } = input ?? {}
  if (!isUuid(id)) return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }
  if (!isCurrentMonth(year, month)) return { ok: false, error: 'Chỉ xác nhận được khoản của tháng này.' }
  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT)) {
    return { ok: false, error: 'Nhập số tiền lớn hơn 0.' }
  }

  const { data: rule, error: ruleError } = await supabase
    .from('recurring_transactions')
    .select('kind, category, amount, day_of_month')
    .eq('id', id)
    .maybeSingle()
  if (ruleError) return failure(ruleError, 'confirmRecurring (read)', 'Không xác nhận được. Vui lòng thử lại.')
  if (!rule) return { ok: false, error: 'Khoản định kỳ không còn tồn tại.' }

  const occurredOn = confirmDate(dueDate(year, month, rule.day_of_month), todayISO())
  const finalAmount = amount ?? rule.amount
  const { data: transactionId, error } = await supabase.rpc('confirm_recurring', {
    p_recurring_id: id,
    p_year: year,
    p_month: month,
    p_amount: finalAmount,
    p_occurred_on: occurredOn,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Khoản này đã được xác nhận trong tháng.' }
    return failure(error, 'confirmRecurring', 'Không xác nhận được. Vui lòng thử lại.')
  }

  const entry = { kind: rule.kind, category: rule.category, amount: finalAmount, occurred_on: occurredOn }
  const [clearedMark, budgetAlert] = await Promise.all([
    rule.kind === 'expense' ? clearNoSpendMark(supabase, occurredOn) : false,
    budgetCrossing(supabase, entry),
  ])

  refresh()
  return { ok: true, transactionId, clearedMark, budgetAlert }
}

/** "Bỏ qua tháng này": the rule stops asking until next month. Never overrides a confirmation. */
export async function skipRecurring(input: { id: string; year: number; month: number }): Promise<ActionResult> {
  const { supabase, user } = await getSession()
  const { id, year, month } = input ?? {}
  if (!isUuid(id)) return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }
  if (!isCurrentMonth(year, month)) return { ok: false, error: 'Chỉ bỏ qua được khoản của tháng này.' }

  const { error } = await supabase
    .from('recurring_runs')
    .upsert({ recurring_id: id, user_id: user.id, year, month, status: 'skipped' }, { onConflict: 'recurring_id,year,month', ignoreDuplicates: true })
  if (error) return failure(error, 'skipRecurring', 'Không bỏ qua được. Vui lòng thử lại.')
  refresh()
  return { ok: true }
}

/** Undo for "Bỏ qua": the rule asks again this month. */
export async function unskipRecurring(input: { id: string; year: number; month: number }): Promise<ActionResult> {
  const { supabase } = await getSession()
  const { id, year, month } = input ?? {}
  if (!isUuid(id) || !isCurrentMonth(year, month)) return { ok: false, error: 'Khoản định kỳ không hợp lệ.' }

  const { error } = await supabase
    .from('recurring_runs')
    .delete()
    .eq('recurring_id', id)
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'skipped')
  if (error) return failure(error, 'unskipRecurring', 'Không hoàn tác được. Vui lòng thử lại.')
  refresh()
  return { ok: true }
}

/**
 * "Lặp lại hằng tháng" in the entry sheet: turns a just-saved transaction into a rule on the same
 * day of the month, and counts this month as already confirmed (it is the transaction itself).
 */
export async function createRecurringFromTransaction(transactionId: string): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await getSession()
  if (!isUuid(transactionId)) return { ok: false, error: 'Giao dịch không hợp lệ.' }

  const { data: t, error: readError } = await supabase
    .from('transactions')
    .select('kind, item_id, category, amount, occurred_on, note')
    .eq('id', transactionId)
    .maybeSingle()
  if (readError) return failure(readError, 'createRecurringFromTransaction (read)', 'Không tạo được khoản định kỳ.')
  if (!t) return { ok: false, error: 'Không tìm thấy giao dịch.' }

  const { data: rule, error } = await supabase
    .from('recurring_transactions')
    .insert({
      user_id: user.id,
      kind: t.kind,
      item_id: t.item_id,
      category: t.category,
      amount: t.amount,
      day_of_month: Number(t.occurred_on.slice(8, 10)),
      note: t.note,
    })
    .select('id')
    .single()
  if (error) return failure(error, 'createRecurringFromTransaction', 'Không tạo được khoản định kỳ. Vui lòng thử lại.')

  const { error: runError } = await supabase.from('recurring_runs').insert({
    recurring_id: rule.id,
    user_id: user.id,
    year: Number(t.occurred_on.slice(0, 4)),
    month: Number(t.occurred_on.slice(5, 7)),
    status: 'done',
    transaction_id: transactionId,
  })
  // Without the run the rule would offer this month again; the rule itself is still useful.
  if (runError) console.error('createRecurringFromTransaction: recording this month failed', runError)

  refresh()
  return { ok: true, id: rule.id }
}
