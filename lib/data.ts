import 'server-only'

import { getSession } from './auth'
import type { BudgetRow } from './finance'
import type { ItemRecord, ItemUsage, TransactionRecord } from './types'

/** Supabase caps each response (1000 rows by default), so long lists are read page by page. */
const PAGE_SIZE = 1000

export async function getTransactionsForYear(year: number): Promise<TransactionRecord[]> {
  const { supabase } = await getSession()
  const rows: TransactionRecord[] = []
  let total: number | null = null

  while (total === null || rows.length < total) {
    const { data, error, count } = await supabase
      .from('transactions')
      .select('id, kind, item, category, amount, occurred_on, note, created_at', {
        count: total === null ? 'exact' : undefined,
      })
      .gte('occurred_on', `${year}-01-01`)
      .lte('occurred_on', `${year}-12-31`)
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
