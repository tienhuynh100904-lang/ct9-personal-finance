import type { BudgetRow, Category, Kind, Txn } from './finance'

/** `item` is the name of the item `item_id` points to (joined in when the rows are read). */
export type TransactionRecord = Txn & { id: string; item_id: string; note: string | null; created_at: string }
export type ItemRecord = {
  id: string
  kind: Kind
  name: string
  default_category: Category | null
  /** Set when the item was hidden because transactions still use it. */
  archived_at: string | null
}
/** One row per item, used or not: how often it was used and the category of its latest use. */
export type ItemUsage = {
  item_id: string
  kind: Kind
  item: string
  uses: number
  last_used_on: string | null
  last_category: Category | null
}

/** What the home screen's habit card needs: a recent window of entries, independent of the viewed year. */
export type HabitData = {
  /** Today in Vietnam time (`YYYY-MM-DD`). */
  today: string
  /** First day of the loaded window. */
  windowStart: string
  /** Hour of day (0-23) in Vietnam time, for the greeting. */
  hour: number
  transactions: TransactionRecord[]
  /** Budget rows of today's month. */
  monthBudget: BudgetRow[]
  /** Days marked "Không chi tiêu" since `windowStart`. */
  noSpendDays: string[]
  /** False when the `day_marks` table does not exist yet (schema not re-run). */
  marksAvailable: boolean
  /** Whether the account has any transaction at all (drives first-run onboarding). */
  hasAnyTransaction: boolean
}
