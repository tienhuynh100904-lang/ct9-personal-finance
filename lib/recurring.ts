/**
 * Recurring transactions (tiền nhà, điện nước, wifi, lương…): a rule says "every month on day N",
 * and each month the app offers the entry for one-tap confirmation instead of creating it silently,
 * because bills like electricity change every month.
 *
 * Pure: no runtime imports, so it runs on the server, in the browser and in tests. Dates are
 * `YYYY-MM-DD` calendar dates in Vietnam time; "today" is always passed in.
 */
import type { Category, Kind } from './finance'

export type RecurringRecord = {
  id: string
  kind: Kind
  item: string
  category: Category
  amount: number
  /** 1–31. Days past the end of a short month fall on its last day (31 → 30/4, 28 or 29/2). */
  day_of_month: number
  note: string | null
  active: boolean
}

export type RecurringRunStatus = 'done' | 'skipped'

/** What happened to a rule in one month: confirmed (a transaction was created) or skipped. */
export type RecurringRun = { recurring_id: string; status: RecurringRunStatus; transaction_id: string | null }

export type RecurringState = 'due' | 'upcoming' | 'done' | 'skipped'

export type MonthlyRecurring = {
  rule: RecurringRecord
  /** This month's date for the rule. */
  due: string
  state: RecurringState
  /** The transaction created on confirmation (lets "Hoàn tác" delete it). */
  transactionId: string | null
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The rule's date in a given month, clamped to the month's last day. */
export function dueDate(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Date recorded on confirmation: the due date once it has passed (rent paid on the 1st and
 * confirmed on the 3rd still belongs to the 1st), but never a future day — confirming the salary
 * early means it arrived early.
 */
export function confirmDate(due: string, today: string): string {
  return due <= today ? due : today
}

const STATE_ORDER: Record<RecurringState, number> = { due: 0, upcoming: 1, skipped: 2, done: 3 }

/** Active rules for the month containing `today`, with their state; actionable ones first. */
export function recurringForMonth(rules: readonly RecurringRecord[], runs: readonly RecurringRun[], today: string): MonthlyRecurring[] {
  const [year, month] = today.split('-').map(Number)
  const runByRule = new Map(runs.map((r) => [r.recurring_id, r]))
  return rules
    .filter((rule) => rule.active)
    .map((rule) => {
      const due = dueDate(year, month, rule.day_of_month)
      const run = runByRule.get(rule.id)
      const state: RecurringState = run ? run.status : due <= today ? 'due' : 'upcoming'
      return { rule, due, state, transactionId: run?.transaction_id ?? null }
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.due.localeCompare(b.due) || a.rule.item.localeCompare(b.rule.item, 'vi'))
}
