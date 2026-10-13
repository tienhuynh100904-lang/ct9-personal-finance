'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import type { BudgetCategory } from '../finance'
import { validateBudgetMonth, type BudgetMonthInput } from '../validation'
import type { ActionResult } from './result'

/**
 * Saves the planned amounts for one month — optionally copying them to every
 * following month of the same year (like dragging a row across in Excel).
 */
export async function saveBudgetMonth(input: BudgetMonthInput): Promise<ActionResult> {
  const { supabase, user } = await getSession()

  const parsed = validateBudgetMonth(input)
  if (!parsed.ok) return { ok: false, error: parsed.fieldErrors }

  const { year, month, values, applyToFollowingMonths } = parsed.value
  const months = applyToFollowingMonths
    ? Array.from({ length: 13 - month }, (_, i) => month + i)
    : [month]
  const entries = Object.entries(values) as [BudgetCategory, number][]
  if (entries.length === 0) return { ok: true }

  const rows = months.flatMap((m) =>
    entries.map(([category, amount]) => ({ user_id: user.id, year, month: m, category, amount })),
  )
  const { error } = await supabase
    .from('budgets')
    .upsert(rows, { onConflict: 'user_id,year,month,category' })

  if (error) {
    console.error('saveBudgetMonth failed', error)
    return { ok: false, error: 'Không lưu được ngân sách. Vui lòng thử lại.' }
  }

  refresh()
  return {
    ok: true,
    message: applyToFollowingMonths && month < 12
      ? `Đã lưu ngân sách tháng ${month}–12/${year}.`
      : `Đã lưu ngân sách tháng ${month}/${year}.`,
  }
}
