/**
 * Khoản tiết kiệm có kỳ hạn (gửi ngân hàng, tái tục…): only tracked here, to see when each one
 * matures and what it will pay. It creates no transaction and does not use up the savings pool, so
 * the same money can sit in a goal and in a deposit at once.
 *
 * Pure, with no runtime imports besides the goals date helper, so it runs on the server, in the
 * browser and in tests. Every date is a `YYYY-MM-DD` calendar date; "today" is always passed in.
 */
import { addMonthsISO } from './goals.ts'

/** Highest yearly rate accepted, in basis points (20%/năm). */
export const MAX_DEPOSIT_RATE_BP = 2000
export const MAX_DEPOSIT_TERM_MONTHS = 120
/** A deposit counts as "sắp đáo hạn" this many days before its maturity date. */
export const DEPOSIT_SOON_DAYS = 14

export type DepositRecord = {
  id: string
  name: string
  principal: number
  /** Yearly rate in basis points (580 = 5,8%/năm). */
  rate_bp: number
  start_date: string
  term_months: number
  note: string | null
  /** Set once the deposit is settled (tất toán) or renewed into a new one. */
  closed_on: string | null
}

export type DepositState = 'closed' | 'matured' | 'soon' | 'later'

export type DepositView = {
  deposit: DepositRecord
  maturity: string
  /** Days from today to maturity; negative once past. */
  daysLeft: number
  /** Length of the whole term in days. */
  termDays: number
  /** Days of the term already passed, from 0 (not started yet) to `termDays` (matured). */
  daysElapsed: number
  /** `daysElapsed / termDays`, 0–1: how far through its term the deposit is. */
  progress: number
  /** Simple interest paid at maturity. */
  interest: number
  /** Principal + interest. */
  payout: number
  state: DepositState
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from))
}

/** The date the deposit matures: start + term (the bank's "ngày đến hạn"). */
export function maturityOf(deposit: Pick<DepositRecord, 'start_date' | 'term_months'>): string {
  return addMonthsISO(deposit.start_date, deposit.term_months)
}

/** Simple interest over the whole term: principal × rate × days / 365, rounded to a đồng. */
export function expectedInterest(deposit: Pick<DepositRecord, 'principal' | 'rate_bp' | 'start_date' | 'term_months'>): number {
  const days = daysBetween(deposit.start_date, maturityOf(deposit))
  return Math.round((deposit.principal * (deposit.rate_bp / 10_000) * days) / 365)
}

export function depositView(deposit: DepositRecord, today: string): DepositView {
  const maturity = maturityOf(deposit)
  const daysLeft = daysBetween(today, maturity)
  const interest = expectedInterest(deposit)
  const state: DepositState = deposit.closed_on ? 'closed' : daysLeft <= 0 ? 'matured' : daysLeft <= DEPOSIT_SOON_DAYS ? 'soon' : 'later'
  const termDays = Math.max(1, daysBetween(deposit.start_date, maturity))
  const daysElapsed = Math.min(termDays, Math.max(0, daysBetween(deposit.start_date, today)))
  return { deposit, maturity, daysLeft, termDays, daysElapsed, progress: daysElapsed / termDays, interest, payout: deposit.principal + interest, state }
}

const STATE_ORDER: Record<DepositState, number> = { matured: 0, soon: 1, later: 2, closed: 3 }

/** Open deposits by maturity (matured ones first, being the most urgent), then the settled ones, newest first. */
export function sortedDeposits(deposits: readonly DepositRecord[], today: string): DepositView[] {
  return deposits
    .map((d) => depositView(d, today))
    .sort((a, b) => {
      if (a.state === 'closed' && b.state === 'closed') return (b.deposit.closed_on ?? '').localeCompare(a.deposit.closed_on ?? '')
      return STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.maturity.localeCompare(b.maturity) || a.deposit.name.localeCompare(b.deposit.name, 'vi')
    })
}

export type DepositSummary = {
  open: DepositView[]
  /** Principal currently in open deposits. */
  principal: number
  /** Interest the open deposits will pay at maturity. */
  interest: number
  /** The open deposit that matures first (possibly already matured). */
  next: DepositView | null
  /** Open deposits that are matured or about to mature. */
  attention: number
}

export function summarizeDeposits(deposits: readonly DepositRecord[], today: string): DepositSummary {
  const open = sortedDeposits(deposits, today).filter((v) => v.state !== 'closed')
  return {
    open,
    principal: open.reduce((sum, v) => sum + v.deposit.principal, 0),
    interest: open.reduce((sum, v) => sum + v.interest, 0),
    next: open[0] ?? null,
    attention: open.filter((v) => v.state === 'matured' || v.state === 'soon').length,
  }
}

/**
 * Money the open deposits hold beyond what was ever saved (and not spent): a hint that a deposit
 * was entered with a wrong amount or that savings entries were deleted. 0 when it adds up.
 */
export function depositsOverSavings(principal: number, saved: number, spent: number): number {
  return Math.max(0, principal - Math.max(0, saved - spent))
}
