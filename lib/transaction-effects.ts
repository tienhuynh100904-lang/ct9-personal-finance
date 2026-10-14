import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { crossedThreshold, SPENDING_CATEGORIES, type BudgetAlert, type Category, type Kind } from './finance'
import { lastOfMonth } from './habit'
import type { Database } from './supabase/database.types'
import { isMissingTable } from './supabase/errors'

type Client = SupabaseClient<Database>
type Entry = { kind: Kind; category: Category; amount: number; occurred_on: string }

/**
 * An expense means the day was not a "no spend" day: drop its mark (best effort). Returns whether a
 * mark was removed, so "Hoàn tác" can put it back.
 */
export async function clearNoSpendMark(supabase: Client, day: string): Promise<boolean> {
  const { data, error } = await supabase.from('day_marks').delete().eq('day', day).select('day')
  if (error) {
    if (!isMissingTable(error)) console.error('clearing day mark failed', error)
    return false
  }
  return data.length > 0
}

/**
 * Whether saving `entry` pushed its spending group past 80% or past 100% of the month's plan.
 * `previous` is the row as it was before an edit, so moving 50.000 ₫ around within the same group
 * and month is not mistaken for new spending. Best effort: a failed read just means no warning.
 */
export async function budgetCrossing(supabase: Client, entry: Entry, previous?: Entry | null): Promise<BudgetAlert | null> {
  if (entry.kind !== 'expense' || !(SPENDING_CATEGORIES as readonly string[]).includes(entry.category)) return null
  const category = entry.category as BudgetAlert['category']
  const prefix = entry.occurred_on.slice(0, 7)
  const [year, month] = prefix.split('-').map(Number)

  // One group's expenses in one month stay far below the 1000-row response cap.
  const [spent, budget] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount')
      .eq('kind', 'expense')
      .eq('category', category)
      .gte('occurred_on', `${prefix}-01`)
      .lte('occurred_on', lastOfMonth(entry.occurred_on)),
    supabase.from('budgets').select('amount').eq('year', year).eq('month', month).eq('category', category).maybeSingle(),
  ])
  if (spent.error || budget.error) {
    console.error('budget check failed', spent.error ?? budget.error)
    return null
  }

  const planned = budget.data?.amount ?? 0
  const actual = spent.data.reduce((total, row) => total + row.amount, 0)
  const counted =
    previous && previous.kind === 'expense' && previous.category === entry.category && previous.occurred_on.startsWith(prefix)
      ? previous.amount
      : 0
  const level = crossedThreshold(actual - entry.amount + counted, actual, planned)
  return level ? { category, level, actual, planned, used: actual / planned } : null
}
