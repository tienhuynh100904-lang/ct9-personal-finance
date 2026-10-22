/**
 * Savings goals ("quỹ"): a faithful port of the workbook "Theo dõi mục tiêu tài chính".
 *
 * - Monthly contribution = Excel `ROUNDUP(PMT(rate/12, months, -existing, target, 1), -3)`.
 * - Interest = simple daily interest between deposits, added to the balance at each deposit
 *   (Excel: balance × rate / 365 × days until the next deposit). Here it also runs up to today.
 * - "Cần gửi mỗi tháng từ giờ" is recomputed from the current balance, like the workbook's
 *   "Cần tiết kiệm các tháng sau" column.
 *
 * Pure, with no runtime imports, so it runs on the server, in the browser and under `node --test`.
 * Every date is a `YYYY-MM-DD` calendar date; "today" is always passed in.
 */

/** Highest expected return accepted, as in the workbook ("không thực tế" above 12%/năm). */
export const MAX_GOAL_RATE_BP = 1200

export type GoalKind = 'emergency' | 'custom'
/** Benchmarks shown for the emergency fund (months of fixed costs). */
export const EMERGENCY_BENCHMARKS = [1, 3, 6] as const

export type GoalRecord = {
  id: string
  kind: GoalKind
  name: string
  target_amount: number
  /** Emergency fund only: fixed costs of one month. */
  monthly_expense: number | null
  /** Emergency fund only: how many months it should cover. */
  reserve_months: number | null
  start_date: string
  months: number
  /** Expected yearly return in basis points (400 = 4%/năm). */
  rate_bp: number
  /** Money already set aside outside the app when the goal started. */
  initial_amount: number
  note: string | null
  archived_at: string | null
}

/**
 * Money moved from the savings pool into a goal (positive) or back out (negative). A row with a
 * `transaction_id` is "Chi từ quỹ": money spent straight from the goal, recorded as that expense.
 */
export type AllocationRecord = {
  id: string
  goal_id: string
  amount: number
  allocated_on: string
  note: string | null
  created_at: string
  transaction_id: string | null
}

// ---- Dates ----------------------------------------------------------------------------

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Excel EDATE: the same day `months` later, clamped to the month's last day. */
export function addMonthsISO(date: string, months: number): string {
  const [y, m, d] = parts(date)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return iso(year, month, Math.min(d, daysInMonth(year, month)))
}

function endOfMonth(date: string): string {
  const [y, m] = parts(date)
  return iso(y, m, daysInMonth(y, m))
}

function dayNumber(date: string): number {
  const [y, m, d] = parts(date)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Excel DATEDIF(from, to, "m"): whole months between two dates (0 when `to` is not later). */
export function wholeMonthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  return Math.max(0, months)
}

/** The date the goal should be reached by: start + months (Excel `EDATE(start, months)`). */
export function deadlineOf(goal: Pick<GoalRecord, 'start_date' | 'months'>): string {
  return addMonthsISO(goal.start_date, goal.months)
}

// ---- Money maths -----------------------------------------------------------------------

/** Excel PMT. `type` 1 = payment at the start of each period (how the workbook saves). */
export function pmt(rate: number, nper: number, pv: number, fv: number, type: 0 | 1 = 0): number {
  if (nper <= 0) return 0
  if (rate === 0) return -(pv + fv) / nper
  const growth = (1 + rate) ** nper
  return -(rate * (pv * growth + fv)) / ((1 + rate * type) * (growth - 1))
}

/** Excel ROUNDUP(x, -3) for a positive amount: up to the next thousand đồng. */
export function roundUpThousand(value: number): number {
  return value <= 0 ? 0 : Math.ceil(value / 1000 - 1e-9) * 1000
}

/** Excel ROUND(x, -3). */
export function roundThousand(value: number): number {
  return Math.round(value / 1000) * 1000
}

/** The emergency fund's target: fixed monthly costs × months of reserve. */
export function emergencyTarget(monthlyExpense: number, reserveMonths: number): number {
  return Math.max(0, monthlyExpense) * Math.max(0, reserveMonths)
}

/**
 * "Số tiền cần tiết kiệm mỗi tháng" of the original plan:
 * `ROUNDUP(PMT(rate/12, months, -existing, target, 1), -3)`, as a positive amount.
 */
export function plannedMonthly(input: { target: number; months: number; rateBp: number; existing: number }): number {
  const { target, months, rateBp, existing } = input
  if (target <= existing) return 0
  return roundUpThousand(-pmt(rateBp / 10_000 / 12, months, -existing, target, 1))
}

export type Accrual = {
  /** Money put in (existing amount + allocations − withdrawals). */
  principal: number
  /** Interest earned so far. */
  interest: number
  balance: number
}

/**
 * Balance of a goal on `asOf`: each deposit is added on its date, and between dates the balance
 * earns `balance × rate / 365 × days`, which then joins the balance (the workbook's columns J–M).
 * Deposits dated after `asOf` are ignored.
 */
export function accrue(entries: readonly { date: string; amount: number }[], rateBp: number, asOf: string): Accrual {
  const rate = rateBp / 10_000
  const sorted = entries.filter((e) => e.date <= asOf).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let principal = 0
  let balance = 0
  let interest = 0
  for (let i = 0; i < sorted.length; i++) {
    principal += sorted[i].amount
    balance += sorted[i].amount
    const until = i + 1 < sorted.length ? sorted[i + 1].date : asOf
    const days = dayNumber(until) - dayNumber(sorted[i].date)
    const earned = balance > 0 ? (balance * rate * days) / 365 : 0
    interest += earned
    balance += earned
  }
  return { principal, interest, balance }
}

/**
 * "Cần tiết kiệm các tháng sau": the monthly amount that still reaches the target by the deadline
 * from today's balance. The month before the deadline (and later) asks for the whole remainder.
 */
export function monthlyFromNow(input: { target: number; balance: number; rateBp: number; deadline: string; today: string }): {
  done: boolean
  amount: number
  monthsLeft: number
} {
  const { target, balance, rateBp, deadline, today } = input
  const monthsLeft = wholeMonthsBetween(endOfMonth(today), deadline)
  if (balance >= target) return { done: true, amount: 0, monthsLeft }
  if (monthsLeft <= 1) return { done: false, amount: roundUpThousand(target - balance), monthsLeft }
  const amount = roundThousand(-pmt(rateBp / 10_000 / 12, monthsLeft, -balance, target, 1))
  return { done: false, amount: Math.max(0, amount), monthsLeft }
}

export type GoalPace = 'done' | 'not_started' | 'on_track' | 'behind' | 'overdue'

export type GoalMilestone = { share: number; amount: number; date: string; reached: boolean }

export type GoalProgress = {
  goal: GoalRecord
  target: number
  deadline: string
  /** Allocations minus withdrawals and spending (excludes the existing amount and interest). */
  allocated: number
  /** Total spent straight from this goal ("Chi từ quỹ"). */
  spent: number
  /** Everything put into this goal from the savings pool ("Tổng nạp"; excludes the existing amount). */
  deposited: number
  /** Taken back out to the savings pool, to be allocated elsewhere ("Rút về tiết kiệm"). Spending is `spent`, not this. */
  withdrawn: number
  accrual: Accrual
  /** 0–1. */
  progress: number
  planned: number
  fromNow: ReturnType<typeof monthlyFromNow>
  pace: GoalPace
  /** Where the balance "should" be today if saving evenly. */
  expectedNow: number
  /** The workbook's four checkpoints: 25%, 50%, 75%, 100% at each quarter of the period. */
  milestones: GoalMilestone[]
}

export function goalProgress(goal: GoalRecord, allocations: readonly AllocationRecord[], today: string): GoalProgress {
  const own = allocations.filter((a) => a.goal_id === goal.id)
  const entries = own.map((a) => ({ date: a.allocated_on, amount: a.amount }))
  if (goal.initial_amount > 0) entries.push({ date: goal.start_date, amount: goal.initial_amount })
  const accrual = accrue(entries, goal.rate_bp, today)
  const target = goal.target_amount
  const deadline = deadlineOf(goal)
  const progress = target > 0 ? Math.min(1, Math.max(0, accrual.balance / target)) : 0

  const totalDays = Math.max(1, dayNumber(deadline) - dayNumber(goal.start_date))
  const elapsed = Math.min(1, Math.max(0, (dayNumber(today) - dayNumber(goal.start_date)) / totalDays))
  const expectedNow = target * elapsed

  let pace: GoalPace
  if (accrual.balance >= target) pace = 'done'
  else if (today < goal.start_date) pace = 'not_started'
  else if (today > deadline) pace = 'overdue'
  else pace = accrual.balance + 1 >= expectedNow ? 'on_track' : 'behind'

  const milestones = [0.25, 0.5, 0.75, 1].map((share) => ({
    share,
    amount: target * share,
    date: addMonthsISO(goal.start_date, Math.round(goal.months * share)),
    reached: accrual.balance >= target * share,
  }))

  return {
    goal,
    target,
    deadline,
    allocated: own.reduce((sum, a) => sum + a.amount, 0),
    spent: own.reduce((sum, a) => sum + (a.transaction_id ? -a.amount : 0), 0),
    deposited: own.reduce((sum, a) => sum + (a.amount > 0 ? a.amount : 0), 0),
    withdrawn: own.reduce((sum, a) => sum + (a.amount < 0 && !a.transaction_id ? -a.amount : 0), 0),
    accrual,
    progress,
    planned: plannedMonthly({ target, months: goal.months, rateBp: goal.rate_bp, existing: goal.initial_amount }),
    fromNow: monthlyFromNow({ target, balance: accrual.balance, rateBp: goal.rate_bp, deadline, today }),
    pace,
    expectedNow,
    milestones,
  }
}

export type Feasibility = 'unknown' | 'not_feasible' | 'feasible' | 'very_feasible'

/**
 * The workbook's verdict on the whole plan, comparing what the goals need each month with what
 * can be saved each month: more than that → not feasible; at least 75% of it → feasible; below →
 * very feasible (room to raise the goals).
 */
export function feasibility(requiredMonthly: number, availableMonthly: number | null): Feasibility {
  if (!availableMonthly || availableMonthly <= 0) return 'unknown'
  if (requiredMonthly > availableMonthly) return 'not_feasible'
  return requiredMonthly >= availableMonthly * 0.75 ? 'feasible' : 'very_feasible'
}

export type SavingsPool = {
  /** All "Tiết kiệm/Đầu tư" entries ever logged. */
  saved: number
  /** Spending paid from goals ("Chi từ quỹ"): that money has left savings for good. */
  spent: number
  /** Net amount sitting in goals (allocations − withdrawals − spending). */
  allocated: number
}

/**
 * Money saved that is not in any goal. Spending from a goal lowers both `spent`'s complement and
 * the goal, so it never changes this number; a withdrawal raises it.
 */
export function unallocated(pool: SavingsPool): number {
  return pool.saved - pool.spent - pool.allocated
}
