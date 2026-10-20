'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { isValidISODate, todayISO } from '../dates'
import { SPENDING_CATEGORIES, type BudgetAlert, type SpendingCategory } from '../finance'
import { goalProgress } from '../goals'
import { formatVND } from '../format'
import { isMissingColumn, isMissingTable } from '../supabase/errors'
import { budgetCrossing, clearNoSpendMark } from '../transaction-effects'
import { MAX_AMOUNT, MAX_NOTE_LENGTH, validateGoal, type FieldErrors, type GoalInput } from '../validation'
import { isUuid, type ActionResult } from './result'

const MISSING_TABLE_MESSAGE = 'Chưa bật tính năng mục tiêu. Hãy chạy lại supabase/schema.sql trong Supabase.'
const MAX_ALLOCATION_NOTE = 200

function failure(error: { code?: string; message?: string } | null, source: string, message: string): { ok: false; error: string } {
  if (isMissingTable(error) || isMissingColumn(error) || error?.code === '42883') return { ok: false, error: MISSING_TABLE_MESSAGE }
  console.error(`${source} failed`, error)
  return { ok: false, error: message }
}

export async function saveGoal(input: GoalInput): Promise<ActionResult<FieldErrors<GoalInput>> & { id?: string }> {
  const { supabase, user } = await getSession()
  const parsed = validateGoal(input)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const id = input?.id
  if (id !== undefined && !isUuid(id)) return { ok: false, error: 'Quỹ không hợp lệ.' }

  // The kind never changes after creation: an existing goal keeps its own.
  const { kind, ...values } = parsed.value
  const { data, error } = id
    ? await supabase.from('goals').update(values).eq('id', id).select('id')
    : await supabase
        .from('goals')
        .insert({ ...values, kind, user_id: user.id })
        .select('id')
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Bạn đã có Quỹ khẩn cấp. Hãy sửa quỹ đó.' }
    if (error.code === '23514') return { ok: false, error: 'Thông tin quỹ không hợp lệ.' }
    return failure(error, 'saveGoal', 'Không lưu được quỹ. Vui lòng thử lại.')
  }
  if (!data.length) return { ok: false, error: 'Không tìm thấy quỹ cần sửa.' }

  refresh()
  return { ok: true, id: data[0].id }
}

/** Archive a reached (or abandoned) goal. Its money stays counted as used, so the pool is unchanged. */
export async function setGoalArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id) || typeof archived !== 'boolean') return { ok: false, error: 'Quỹ không hợp lệ.' }
  const { data, error } = await supabase
    .from('goals')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('kind', 'custom')
    .select('id')
  if (error) return failure(error, 'setGoalArchived', 'Không cập nhật được quỹ. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Không tìm thấy quỹ.' }
  refresh()
  return { ok: true }
}

/**
 * Deletes a goal and its allocations: the money it held goes back to "chưa phân bổ". The emergency
 * fund can be deleted too; the page then offers to set it up again.
 */
export async function deleteGoal(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Quỹ không hợp lệ.' }
  const { data, error } = await supabase.from('goals').delete().eq('id', id).select('id')
  if (error) return failure(error, 'deleteGoal', 'Không xoá được quỹ. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Quỹ này không còn tồn tại.' }
  refresh()
  return { ok: true }
}

export type AllocationItem = { goalId: string; amount: number }

/**
 * Moves saved money into one or several goals (positive amounts) or back out of a goal (negative).
 * The database checks, under a lock, that the pool and each goal have enough.
 */
export async function allocateSavings(input: { items: AllocationItem[]; date: string; note?: string }): Promise<ActionResult> {
  const { supabase } = await getSession()
  const items = Array.isArray(input?.items) ? input.items.filter((i) => i && i.amount !== 0) : []
  if (items.length === 0) return { ok: false, error: 'Nhập số tiền cho ít nhất một quỹ.' }
  for (const item of items) {
    if (!isUuid(item.goalId)) return { ok: false, error: 'Quỹ không hợp lệ.' }
    if (!Number.isInteger(item.amount) || Math.abs(item.amount) > MAX_AMOUNT) return { ok: false, error: 'Số tiền không hợp lệ.' }
  }
  const date = typeof input?.date === 'string' ? input.date : ''
  if (!isValidISODate(date) || date < '2000-01-01' || date > todayISO()) return { ok: false, error: 'Ngày không hợp lệ (không chọn ngày tương lai).' }
  const note = typeof input?.note === 'string' ? input.note.trim() : ''
  if (note.length > MAX_ALLOCATION_NOTE) return { ok: false, error: `Ghi chú tối đa ${MAX_ALLOCATION_NOTE} ký tự.` }

  const { error } = await supabase.rpc('allocate_savings', {
    p_items: items.map((i) => ({ goal_id: i.goalId, amount: i.amount })),
    p_on: date,
    p_note: note || null,
  })
  if (error) {
    const reason = error.message ?? ''
    if (reason.includes('insufficient_pool')) return { ok: false, error: 'Số tiền vượt quá tiền tiết kiệm chưa phân bổ.' }
    if (reason.includes('goal_balance')) return { ok: false, error: 'Không thể rút nhiều hơn số đã phân bổ vào quỹ.' }
    if (reason.includes('goal_not_found')) return { ok: false, error: 'Không tìm thấy quỹ (hoặc quỹ đã lưu trữ).' }
    return failure(error, 'allocateSavings', 'Không phân bổ được. Vui lòng thử lại.')
  }
  refresh()
  return { ok: true }
}

/**
 * Removes one allocation or withdrawal from a goal's history. Undoing a withdrawal needs the money
 * to still be free. Spending from a goal is the transaction itself: it is changed in Thu chi.
 */
export async function deleteAllocation(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Mục không hợp lệ.' }

  const { data: entry, error: readError } = await supabase.from('goal_allocations').select('amount, transaction_id').eq('id', id).maybeSingle()
  if (readError) return failure(readError, 'deleteAllocation (read)', 'Không xoá được. Vui lòng thử lại.')
  if (!entry) return { ok: false, error: 'Mục này không còn tồn tại.' }
  if (entry.transaction_id) {
    return { ok: false, error: 'Đây là khoản chi từ quỹ. Hãy sửa hoặc xoá giao dịch đó ở trang Thu chi, quỹ sẽ tự cập nhật.' }
  }
  if (entry.amount < 0) {
    const { data: pool, error: poolError } = await supabase.from('savings_pool').select('saved, allocated, spent').maybeSingle()
    if (poolError) return failure(poolError, 'deleteAllocation (pool)', 'Không xoá được. Vui lòng thử lại.')
    if ((pool?.saved ?? 0) - (pool?.spent ?? 0) - (pool?.allocated ?? 0) < -entry.amount) {
      return { ok: false, error: 'Tiền tiết kiệm chưa phân bổ không đủ để hoàn tác lần rút này.' }
    }
  }

  const { error } = await supabase.from('goal_allocations').delete().eq('id', id)
  if (error) return failure(error, 'deleteAllocation', 'Không xoá được. Vui lòng thử lại.')
  refresh()
  return { ok: true }
}

export type SpendInput = {
  goalId: string
  amount: number
  /** An expense item of the user's list. */
  itemId: string
  category: SpendingCategory
  date: string
  note?: string
}

/**
 * "Chi từ quỹ": records an expense paid with money from a goal and takes it out of the goal, in one
 * step. The expense shows in Thu chi like any other (budgets, warnings), but is marked so the month's
 * surplus can leave it out. Deleting that transaction (or "Hoàn tác") puts the money back in the goal.
 */
export async function spendFromGoal(
  input: SpendInput,
): Promise<ActionResult & { transactionId?: string; clearedMark?: boolean; budgetAlert?: BudgetAlert | null }> {
  const { supabase } = await getSession()
  const goalId = input?.goalId
  if (!isUuid(goalId)) return { ok: false, error: 'Quỹ không hợp lệ.' }
  const amount = input?.amount
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) return { ok: false, error: 'Nhập số tiền lớn hơn 0.' }
  const itemId = input?.itemId
  if (!isUuid(itemId)) return { ok: false, error: 'Chọn khoản mục đã chi.' }
  const category = input?.category
  if (!(SPENDING_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Chọn phân loại chi tiêu.' }
  const date = typeof input?.date === 'string' ? input.date : ''
  if (!isValidISODate(date) || date < '2000-01-01' || date > todayISO()) return { ok: false, error: 'Ngày không hợp lệ (không chọn ngày tương lai).' }
  const note = typeof input?.note === 'string' ? input.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.` }

  // The goal can pay at most what it holds today (existing money + allocations + interest).
  const [goal, allocations] = await Promise.all([
    supabase
      .from('goals')
      .select('id, kind, name, target_amount, monthly_expense, reserve_months, start_date, months, rate_bp, place, initial_amount, note, archived_at')
      .eq('id', goalId)
      .maybeSingle(),
    supabase.from('goal_allocations').select('id, goal_id, amount, allocated_on, note, created_at, transaction_id').eq('goal_id', goalId),
  ])
  if (goal.error || allocations.error) return failure(goal.error ?? allocations.error, 'spendFromGoal (read)', 'Không chi được. Vui lòng thử lại.')
  if (!goal.data) return { ok: false, error: 'Không tìm thấy quỹ.' }
  const balance = Math.floor(goalProgress(goal.data, allocations.data ?? [], todayISO()).accrual.balance)
  if (amount > balance) return { ok: false, error: `Quỹ chỉ còn ${formatVND(Math.max(0, balance))}.` }

  const { data: transactionId, error } = await supabase.rpc('spend_from_goal', {
    p_goal_id: goalId,
    p_amount: amount,
    p_item_id: itemId,
    p_category: category,
    p_occurred_on: date,
    p_note: note || null,
  })
  if (error) {
    if (error.message.includes('item_not_found')) return { ok: false, error: 'Khoản mục không còn trong danh mục. Hãy chọn lại.' }
    return failure(error, 'spendFromGoal', 'Không chi được. Vui lòng thử lại.')
  }

  const [clearedMark, budgetAlert] = await Promise.all([
    clearNoSpendMark(supabase, date),
    budgetCrossing(supabase, { kind: 'expense', category, amount, occurred_on: date }),
  ])
  refresh()
  return { ok: true, transactionId, clearedMark, budgetAlert }
}
