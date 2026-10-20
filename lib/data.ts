import 'server-only'

import { getSession } from './auth'
import type { DepositRecord } from './deposits'
import type { BudgetRow } from './finance'
import { habitWindowStart, lastOfMonth } from './habit'
import { RECURRING_ITEM_JOIN, TRANSACTION_ITEM_JOIN, withItemName } from './items'
import { addMonthsISO, type AllocationRecord, type GoalRecord, type SavingsPool } from './goals'
import { DEFAULT_REMIND_DAYS, type RecurringRecord, type RecurringRun } from './recurring'
import { normalizeRemindAt } from './reminders'
import { isMissingColumn, isMissingTable } from './supabase/errors'
import type { HabitData, ItemRecord, ItemUsage, TransactionRecord } from './types'

/** Supabase caps each response (1000 rows by default), so long lists are read page by page. */
const PAGE_SIZE = 1000

export async function getTransactionsForYear(year: number): Promise<TransactionRecord[]> {
  return readTransactions(`${year}-01-01`, `${year}-12-31`)
}

const TRANSACTION_COLUMNS = `id, kind, item_id, category, amount, occurred_on, note, created_at, ${TRANSACTION_ITEM_JOIN}`

/** Transactions with `occurred_on` in `[from, to]`, newest first. */
async function readTransactions(from: string, to: string): Promise<TransactionRecord[]> {
  try {
    return await readTransactionPages(from, to, `${TRANSACTION_COLUMNS}, from_savings`)
  } catch (error) {
    // `from_savings` ("Chi từ quỹ") arrives with a newer schema.sql: until it is run, read without it.
    if (!(error instanceof MissingColumnError)) throw error
    return readTransactionPages(from, to, TRANSACTION_COLUMNS)
  }
}

class MissingColumnError extends Error {}

async function readTransactionPages(from: string, to: string, columns: string): Promise<TransactionRecord[]> {
  const { supabase } = await getSession()
  const rows: TransactionRecord[] = []
  let total: number | null = null

  while (total === null || rows.length < total) {
    const { data, error, count } = await supabase
      .from('transactions')
      .select(columns, {
        count: total === null ? 'exact' : undefined,
      })
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(rows.length, rows.length + PAGE_SIZE - 1)

    if (error) {
      if (isMissingColumn(error)) throw new MissingColumnError(error.message)
      throw new Error(`Không tải được giao dịch: ${error.message}`)
    }
    if (total === null) total = count ?? data.length
    if (data.length === 0) break
    rows.push(...(data as unknown as { items: { name: string } | null }[]).map((row) => withItemName(row) as unknown as TransactionRecord))
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
    .select('id, kind, name, default_category, archived_at')
    .order('name')
  if (error) throw new Error(`Không tải được danh mục: ${error.message}`)
  return data
}

export async function getItemUsage(): Promise<ItemUsage[]> {
  const { supabase } = await getSession()
  const { data, error } = await supabase
    .from('item_usage')
    .select('item_id, kind, item, uses, last_used_on, last_category')
    .order('uses', { ascending: false })
  if (error) throw new Error(`Không tải được thống kê khoản mục: ${error.message}`)
  return data
}

export type ReminderSettings = { enabled: boolean; remindAt: string }

/** The daily reminder setting, or `null` when the table is missing (schema.sql not re-run yet). */
export async function getReminderSettings(): Promise<ReminderSettings | null> {
  const { supabase } = await getSession()
  const { data, error } = await supabase.from('reminder_settings').select('enabled, remind_at').maybeSingle()
  if (error) {
    if (isMissingTable(error)) return null
    throw new Error(`Không tải được cài đặt nhắc: ${error.message}`)
  }
  return { enabled: data?.enabled ?? false, remindAt: normalizeRemindAt(data?.remind_at) }
}

export type RecurringData = {
  rules: RecurringRecord[]
  /** What happened to each rule in `today`'s month. */
  runs: RecurringRun[]
  today: string
}

/** Recurring rules plus this month's confirmations, or `null` when schema.sql has not been re-run yet. */
export async function getRecurringData(today: string): Promise<RecurringData | null> {
  const { supabase } = await getSession()
  const [year, month] = today.split('-').map(Number)
  const readRules = (columns: string) =>
    supabase.from('recurring_transactions').select(`${columns}, ${RECURRING_ITEM_JOIN}`).order('day_of_month')
  const [rulesResult, runs] = await Promise.all([
    readRules('id, kind, item_id, category, amount, day_of_month, remind_days, note, active'),
    supabase.from('recurring_runs').select('recurring_id, status, transaction_id').eq('year', year).eq('month', month),
  ])
  // `remind_days` arrives with a newer schema.sql: until it is run, every rule uses the default window.
  const rules = isMissingColumn(rulesResult.error) ? await readRules('id, kind, item_id, category, amount, day_of_month, note, active') : rulesResult
  for (const { error } of [rules, runs]) {
    if (!error) continue
    if (isMissingTable(error)) return null
    throw new Error(`Không tải được giao dịch định kỳ: ${error.message}`)
  }
  const named = (rules.data ?? []).map((row) => {
    const rule = withItemName(row as unknown as { items: { name: string } | null }) as unknown as RecurringRecord
    return { ...rule, remind_days: rule.remind_days ?? DEFAULT_REMIND_DAYS }
  })
  named.sort((a, b) => a.day_of_month - b.day_of_month || a.item.localeCompare(b.item, 'vi'))
  return { rules: named, runs: runs.data ?? [], today }
}

export type GoalsData = {
  goals: GoalRecord[]
  allocations: AllocationRecord[]
  /** All "Tiết kiệm/Đầu tư" entries ever logged, what was spent from goals, and what sits in goals. */
  pool: SavingsPool
  /** This month's "Tiết kiệm/Đầu tư" budget: what can go into goals each month (0 = not set). */
  monthlySaving: number
  /** Average "Thiết yếu" spending of the last 3 full months, to suggest the emergency fund's monthly cost. */
  essentialAverage: number | null
  today: string
}

/** Everything the goals page needs, or `null` when schema.sql has not been re-run yet. */
export async function getGoalsData(today: string): Promise<GoalsData | null> {
  const { supabase } = await getSession()
  const [year, month] = today.split('-').map(Number)
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const threeMonthsAgo = addMonthsISO(firstOfMonth, -3)

  const [goals, allocations, pool, budget, essential] = await Promise.all([
    supabase
      .from('goals')
      .select('id, kind, name, target_amount, monthly_expense, reserve_months, start_date, months, rate_bp, place, initial_amount, note, archived_at')
      .order('created_at'),
    supabase
      .from('goal_allocations')
      .select('id, goal_id, amount, allocated_on, note, created_at, transaction_id')
      .order('allocated_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('savings_pool').select('saved, allocated, spent').maybeSingle(),
    supabase.from('budgets').select('amount').eq('year', year).eq('month', month).eq('category', 'saving').maybeSingle(),
    supabase.from('transactions').select('amount').eq('kind', 'expense').eq('category', 'essential').gte('occurred_on', threeMonthsAgo).lt('occurred_on', firstOfMonth),
  ])
  for (const { error } of [goals, allocations, pool]) {
    if (!error) continue
    // A missing table or column means schema.sql (sections 11+) has not been re-run: the page says so.
    if (isMissingTable(error) || isMissingColumn(error)) return null
    throw new Error(`Không tải được mục tiêu: ${error.message}`)
  }
  if (budget.error) throw new Error(`Không tải được ngân sách: ${budget.error.message}`)
  if (essential.error) throw new Error(`Không tải được giao dịch: ${essential.error.message}`)

  const essentialTotal = (essential.data ?? []).reduce((sum, row) => sum + row.amount, 0)
  return {
    goals: goals.data ?? [],
    allocations: allocations.data ?? [],
    pool: { saved: pool.data?.saved ?? 0, spent: pool.data?.spent ?? 0, allocated: pool.data?.allocated ?? 0 },
    monthlySaving: budget.data?.amount ?? 0,
    essentialAverage: essentialTotal > 0 ? Math.round(essentialTotal / 3 / 1000) * 1000 : null,
    today,
  }
}

/** Khoản tiết kiệm có kỳ hạn, or `null` when schema.sql has not been re-run yet. */
export async function getDepositsData(): Promise<DepositRecord[] | null> {
  const { supabase } = await getSession()
  const { data, error } = await supabase
    .from('savings_deposits')
    .select('id, name, principal, rate_bp, start_date, term_months, note, closed_on')
    .order('start_date', { ascending: false })
  if (error) {
    if (isMissingTable(error) || isMissingColumn(error)) return null
    throw new Error(`Không tải được khoản tiết kiệm: ${error.message}`)
  }
  return data
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

