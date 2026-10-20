/**
 * Logging-habit model: which days have been recorded, the streak, the
 * "what can I still spend today" allowance and one-tap presets.
 *
 * Pure functions with no runtime imports. Every date is a `YYYY-MM-DD` calendar
 * date in Vietnam time; "today" is always passed in (never read from the clock).
 */
import type { BudgetRow, Category, Txn } from './finance'

/** How many days back the habit features look (streak, gaps, week strip). */
export const HABIT_WINDOW_DAYS = 63

const SPENDING = new Set<Category>(['essential', 'non_essential', 'incidental'])

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function lastOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${iso.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, '0')}`
}

/** First day the habit features read: 62 days back (always before the 1st of this month). */
export function habitWindowStart(today: string): string {
  return addDays(today, -(HABIT_WINDOW_DAYS - 1))
}

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

export function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export type DayLog = {
  count: number
  expenseCount: number
  /** Spending that counts towards "Chi tiêu" (savings excluded). */
  spending: number
  income: number
  noSpend: boolean
}

function emptyLog(): DayLog {
  return { count: 0, expenseCount: 0, spending: 0, income: 0, noSpend: false }
}

export function buildDayLog(txns: readonly Txn[], noSpendDays: readonly string[]): Map<string, DayLog> {
  const log = new Map<string, DayLog>()
  const at = (day: string) => {
    let entry = log.get(day)
    if (!entry) {
      entry = emptyLog()
      log.set(day, entry)
    }
    return entry
  }
  for (const t of txns) {
    const entry = at(t.occurred_on)
    entry.count += 1
    if (t.kind === 'income') entry.income += t.amount
    else {
      entry.expenseCount += 1
      if (SPENDING.has(t.category)) entry.spending += t.amount
    }
  }
  for (const day of noSpendDays) at(day).noSpend = true
  return log
}

/** A day is "đã ghi" if it has any transaction or an explicit "Không chi tiêu" mark. */
export function isLogged(entry: DayLog | undefined): boolean {
  return Boolean(entry && (entry.count > 0 || entry.noSpend))
}

export type Streak = {
  current: number
  /** The streak reaches the start of the window, so the true length is at least `current`. */
  capped: boolean
  todayLogged: boolean
  anyLogged: boolean
}

/**
 * Consecutive logged days. Today never counts as missed: while it is still empty the
 * streak is counted back from yesterday. Days after today are ignored.
 */
export function loggingStreak(log: Map<string, DayLog>, today: string, windowStart: string): Streak {
  const todayLogged = isLogged(log.get(today))
  let day = todayLogged ? today : addDays(today, -1)
  let current = 0
  while (day >= windowStart && isLogged(log.get(day))) {
    current += 1
    day = addDays(day, -1)
  }
  const capped = current > 0 && day < windowStart
  let anyLogged = false
  for (const [d, entry] of log) {
    if (d <= today && d >= windowStart && isLogged(entry)) {
      anyLogged = true
      break
    }
  }
  return { current, capped, todayLogged, anyLogged }
}

/** Unlogged days ending yesterday (never includes today). */
export function recentGap(
  log: Map<string, DayLog>,
  today: string,
  windowStart: string,
): { days: number; hasEarlierLog: boolean } {
  let day = addDays(today, -1)
  let days = 0
  while (day >= windowStart && !isLogged(log.get(day))) {
    days += 1
    day = addDays(day, -1)
  }
  return { days, hasEarlierLog: day >= windowStart && isLogged(log.get(day)) }
}

/** "18/21 ngày có ghi chép": days logged this month out of the days that have fully passed. */
export function monthCoverage(log: Map<string, DayLog>, today: string): { logged: number; elapsed: number } {
  const day = Number(today.slice(8))
  const todayLogged = isLogged(log.get(today))
  let logged = 0
  for (let d = 1; d <= day; d++) {
    if (isLogged(log.get(`${today.slice(0, 8)}${String(d).padStart(2, '0')}`))) logged += 1
  }
  return { logged, elapsed: day - (todayLogged ? 0 : 1) }
}

export type CellState = 'logged' | 'no_spend' | 'pending' | 'empty'
export type WeekCell = { iso: string; label: string; state: CellState; count: number; isToday: boolean }

/**
 * The last 7 days ending today (rolling, so the strip is never mostly empty at the
 * start of a week). An expense or any transaction wins over a "không chi tiêu" mark.
 */
export function weekCells(log: Map<string, DayLog>, today: string): WeekCell[] {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(today, i - 6)
    const entry = log.get(iso)
    const isToday = iso === today
    let state: CellState
    if (entry && entry.count > 0) state = 'logged'
    else if (entry?.noSpend) state = 'no_spend'
    else state = isToday ? 'pending' : 'empty'
    return { iso, label: weekdayShort(iso), state, count: entry?.count ?? 0, isToday }
  })
}

export type AllowanceStatus = 'no_budget' | 'ok' | 'over_today' | 'month_over'

export type Allowance = {
  status: AllowanceStatus
  planned: number
  spentToday: number
  todayCount: number
  /** What is left of this month's spending budget after today's spending. */
  monthRemaining: number
  daysLeft: number
  /** Suggested spending for today (budget left at the start of the day ÷ days left). */
  allowance: number
  /** `allowance − spentToday`, never negative. */
  remainingToday: number
  /** How far over: today's suggestion (`over_today`) or the month's budget (`month_over`). */
  overBy: number
}

/**
 * "Hôm nay còn được chi": the month's spending budget (thiết yếu + không thiết yếu + phát sinh)
 * minus what was spent on earlier days, spread over the days left including today.
 * Because the day's allowance is fixed at the start of the day, every logged expense
 * visibly lowers "còn được chi".
 */
export function dailyAllowance(input: {
  txns: readonly Txn[]
  /** Budget rows of today's month. */
  monthBudget: readonly BudgetRow[]
  today: string
}): Allowance {
  const { txns, monthBudget, today } = input
  const [year, month] = today.split('-').map(Number)
  const day = Number(today.slice(8))
  const prefix = today.slice(0, 7)

  let planned = 0
  for (const row of monthBudget) if (row.month === month && SPENDING.has(row.category as Category)) planned += row.amount

  let spentBefore = 0
  let spentToday = 0
  let todayCount = 0
  for (const t of txns) {
    if (t.occurred_on === today) todayCount += 1
    if (t.kind !== 'expense' || !SPENDING.has(t.category) || !t.occurred_on.startsWith(prefix)) continue
    if (t.occurred_on < today) spentBefore += t.amount
    else if (t.occurred_on === today) spentToday += t.amount
  }

  const daysLeft = daysInMonth(year, month) - day + 1
  const base = planned - spentBefore
  const monthRemaining = base - spentToday
  const perDay = base / daysLeft
  const allowance = perDay <= 0 ? 0 : perDay >= 1000 ? Math.floor(perDay / 1000) * 1000 : Math.floor(perDay)
  const remainingToday = Math.max(0, allowance - spentToday)

  let status: AllowanceStatus = 'ok'
  let overBy = 0
  if (planned <= 0) status = 'no_budget'
  else if (base <= 0 || monthRemaining < 0) {
    status = 'month_over'
    overBy = Math.max(0, -monthRemaining)
  } else if (allowance - spentToday < 0) {
    status = 'over_today'
    overBy = spentToday - allowance
  }

  return { status, planned, spentToday, todayCount, monthRemaining: Math.max(0, monthRemaining), daysLeft, allowance, remainingToday, overBy }
}

export type Preset = { item_id: string; item: string; category: Category; amount: number; count: number }

/** Most frequent expense items of the last 30 days, each with its latest amount and category. */
export function recentPresets(txns: readonly Txn[], today: string, limit = 6): Preset[] {
  const from = addDays(today, -29)
  const groups = new Map<string, Preset & { lastDate: string; lastStamp: string }>()
  for (const t of txns as readonly (Txn & { item_id?: string; created_at?: string })[]) {
    if (t.kind !== 'expense' || t.category === 'saving' || t.occurred_on < from || t.occurred_on > today) continue
    const stamp = t.created_at ?? ''
    const group = groups.get(t.item)
    if (!group) {
      groups.set(t.item, { item_id: t.item_id ?? '', item: t.item, category: t.category, amount: t.amount, count: 1, lastDate: t.occurred_on, lastStamp: stamp })
      continue
    }
    group.count += 1
    if (t.occurred_on > group.lastDate || (t.occurred_on === group.lastDate && stamp > group.lastStamp)) {
      group.lastDate = t.occurred_on
      group.lastStamp = stamp
      group.amount = t.amount
      group.category = t.category
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0) || a.item.localeCompare(b.item, 'vi'))
    .slice(0, limit)
    .map(({ item_id, item, category, amount, count }) => ({ item_id, item, category, amount, count }))
}

export function greeting(hour: number): string {
  if (hour >= 4 && hour <= 10) return 'Chào buổi sáng'
  if (hour >= 11 && hour <= 13) return 'Chào buổi trưa'
  if (hour >= 14 && hour <= 17) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}
