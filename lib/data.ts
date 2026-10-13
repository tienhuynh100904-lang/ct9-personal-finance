import 'server-only'

import { getSession } from './auth'
import type { BudgetRow } from './finance'
import { habitWindowStart, lastOfMonth } from './habit'
import { isMissingTable } from './supabase/errors'
import type { HabitData, ItemRecord, ItemUsage, TransactionRecord } from './types'

/** Supabase caps each response (1000 rows by default), so long lists are read page by page. */
const PAGE_SIZE = 1000

export async function getTransactionsForYear(year: number): Promise<TransactionRecord[]> {
  return readTransactions(`${year}-01-01`, `${year}-12-31`)
}

/** Transactions with `occurred_on` in `[from, to]`, newest first. */
async function readTransactions(from: string, to: string): Promise<TransactionRecord[]> {
  const { supabase } = await getSession()
  const rows: TransactionRecord[] = []
  let total: number | null = null

  while (total === null || rows.length < total) {
    const { data, error, count } = await supabase
      .from('transactions')
      .select('id, kind, item, category, amount, occurred_on, note, created_at', {
        count: total === null ? 'exact' : undefined,
      })
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(rows.length, rows.length + PAGE_SIZE - 1)

    if (error) throw new Error(`Không tải được giao dịch: ${error.message}`)
    if (total === null) total = count ?? data.length
    if (data.length === 0) break
    rows.push(...data)
  }
  return rows
}

export async function getBudgetRows(year: number): Promise<BudgetRow[]> {
  const { supabase } = await getSession()
  const { data, error } = await supabase
    .from('budgets')
    .select('month, category, amount')
    .eq('year', year)
  if (error) throw new Error(`Không tải được ngân sách: ${error.message}`)
  return data
}

export async function getItems(): Promise<ItemRecord[]> {
  const { supabase } = await getSession()
  const { data, error } = await supabase
    .from('items')
    .select('id, kind, name, default_category')
    .order('name')
  if (error) throw new Error(`Không tải được danh mục: ${error.message}`)
  return data
}

export async function getItemUsage(): Promise<ItemUsage[]> {
  const { supabase } = await getSession()
  const { data, error } = await supabase
    .from('item_usage')
    .select('kind, item, uses, last_used_on, last_category')
    .order('uses', { ascending: false })
  if (error) throw new Error(`Không tải được thống kê khoản mục: ${error.message}`)
  return data
}

/** Years the year pickers offer: every year with data, plus this year and next (for planning). */
export async function getYearOptions(currentYear: number): Promise<number[]> {
  const { supabase } = await getSession()
  const [first, last, budgetFirst] = await Promise.all([
    supabase.from('transactions').select('occurred_on').order('occurred_on').limit(1).maybeSingle(),
    supabase.from('transactions').select('occurred_on').order('occurred_on', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('budgets').select('year').order('year').limit(1).maybeSingle(),
  ])
  const candidates = [
    currentYear,
    currentYear + 1,
    first.data ? Number(first.data.occurred_on.slice(0, 4)) : currentYear,
    last.data ? Number(last.data.occurred_on.slice(0, 4)) : currentYear,
    budgetFirst.data?.year ?? currentYear,
  ]
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  return Array.from({ length: max - min + 1 }, (_, i) => max - i)
}

/**
 * Everything the home screen's habit card needs, for a window of recent days that is
 * independent of the year being viewed (so a streak survives New Year).
 * The "Không chi tiêu" table is optional: if it is missing, the rest still works.
 */
export async function getHabitData(today: string, hour: number): Promise<HabitData> {
  const { supabase } = await getSession()
  const windowStart = habitWindowStart(today)
  const [year, month] = today.split('-').map(Number)

  const [transactions, budget, marks] = await Promise.all([
    readTransactions(windowStart, lastOfMonth(today)),
    supabase.from('budgets').select('month, category, amount').eq('year', year).eq('month', month),
    supabase.from('day_marks').select('day').gte('day', windowStart).lte('day', today),
  ])
  if (budget.error) throw new Error(`Không tải được ngân sách: ${budget.error.message}`)

  let noSpendDays: string[] = []
  let marksAvailable = true
  if (marks.error) {
    marksAvailable = false
    if (!isMissingTable(marks.error)) console.error('day_marks read failed', marks.error)
  } else {
    noSpendDays = marks.data.map((row) => row.day)
  }

  let hasAnyTransaction = transactions.length > 0
  if (!hasAnyTransaction) {
    const { count, error } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
    if (error) throw new Error(`Không tải được giao dịch: ${error.message}`)
    hasAnyTransaction = (count ?? 0) > 0
  }

  return {
    today,
    windowStart,
    hour,
    transactions,
    monthBudget: budget.data,
    noSpendDays,
    marksAvailable,
    hasAnyTransaction,
  }
}

