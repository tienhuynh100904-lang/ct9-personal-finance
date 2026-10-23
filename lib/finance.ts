/**
 * Pure finance computations — a faithful port of the formulas in the original
 * Excel workbook ("Phân loại thu chi" and "Lập ngân sách" sheets).
 *
 * This module has no runtime imports so it runs unchanged on the server, in the
 * browser, and under `node --test`.
 */

export const INCOME_CATEGORIES = ['main', 'side', 'irregular'] as const
/** Spending types that count towards "Tổng chi tiêu" (savings excluded, as in Excel). */
export const SPENDING_CATEGORIES = ['essential', 'non_essential', 'incidental'] as const
export const EXPENSE_CATEGORIES = [...SPENDING_CATEGORIES, 'saving'] as const
export const BUDGET_CATEGORIES = [...INCOME_CATEGORIES, ...SPENDING_CATEGORIES, 'saving'] as const

export type Kind = 'income' | 'expense'
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type Category = IncomeCategory | ExpenseCategory
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]

/** Twelve values, index 0 = January. */
export type Monthly = number[]

export type Txn = {
  kind: Kind
  item: string
  category: Category
  amount: number
  /** Calendar date, `YYYY-MM-DD`. */
  occurred_on: string
  /**
   * "Chi từ quỹ": an expense paid with money taken out of a savings goal. Still spending, but by
   * default it is left out of the month's surplus, because it was not paid from that month's income.
   */
  from_savings?: boolean
  /**
   * "Muốn giảm": an expense marked at the month-end review as something to cut. Missing until the
   * database has the column; only spending (not savings) can carry it.
   */
  cut_candidate?: boolean
}

export type BudgetRow = {
  month: number
  category: BudgetCategory
  amount: number
}

export function categoriesFor(kind: Kind): readonly Category[] {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function isCategoryOf(kind: Kind, category: string): category is Category {
  return (categoriesFor(kind) as readonly string[]).includes(category)
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4))
}

/** 1-based month of a `YYYY-MM-DD` date. */
export function monthOf(date: string): number {
  return Number(date.slice(5, 7))
}

export function zeros(): Monthly {
  return Array.from({ length: 12 }, () => 0)
}

export function sum(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

/** Excel's `IFERROR(a / b, 0)`. */
export function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function addMonthly(...series: Monthly[]): Monthly {
  return zeros().map((_, i) => sum(series.map((s) => s[i])))
}

function byCategory<C extends string>(categories: readonly C[]): Record<C, Monthly> {
  return Object.fromEntries(categories.map((c) => [c, zeros()])) as Record<C, Monthly>
}

export type YearReport = {
  year: number
  /** "BẢNG THU NHẬP THEO KHOẢN MỤC" */
  income: Record<IncomeCategory, Monthly>
  incomeTotal: Monthly
  /** "TỶ TRỌNG THU NHẬP THEO KHOẢN MỤC (%)" */
  incomeShare: Record<IncomeCategory, Monthly>
  /** "BẢNG CHI TIÊU THEO KHOẢN MỤC" — essential / non-essential / incidental */
  spending: Record<SpendingCategory, Monthly>
  /** "Tổng chi tiêu" — excludes savings, exactly like the workbook. */
  spendingTotal: Monthly
  /** "TỶ TRỌNG CHI TIÊU THEO KHOẢN MỤC (%)" */
  spendingShare: Record<SpendingCategory, Monthly>
  /** Column O: AVERAGE over the 12 months (months without data count as 0). */
  spendingAverage: Record<SpendingCategory, number>
  /** "Tiết kiệm/Đầu tư" */
  saving: Monthly
  /** Spending paid from a savings goal ("Chi từ quỹ"); already included in `spending`. */
  fundSpending: Monthly
  /**
   * "Thặng dư hàng tháng" = thu nhập − chi tiêu − tiết kiệm. Unless `includeFundSpending` is set,
   * spending paid from a goal is added back: it did not come out of the month's income.
   */
  surplus: Monthly
  /** Whether `surplus` counts spending paid from goals. */
  includesFundSpending: boolean
  /** "Tỷ lệ có thể tiết kiệm" = IFERROR((thu − chi) / thu, 0) */
  potentialSavingRate: Monthly
  /** "Thực tế tiết kiệm" = tiết kiệm / thu. `null` where Excel shows #DIV/0!. */
  actualSavingRate: (number | null)[]
  /** "TỔNG QUAN CẢ NĂM" */
  totals: {
    income: number
    spending: number
    saving: number
    fundSpending: number
    surplus: number
    /** "Thu nhập TB/tháng" = tổng năm / 12 */
    avgIncome: number
    /** "Chi tiêu TB/tháng" = tổng năm / 12 */
    avgSpending: number
    /**
     * "Tích lũy (tiết kiệm + thặng dư)" = thu nhập − chi tiêu: what the year really added. It is the
     * same whichever way the surplus treats spending paid from goals.
     */
    accumulation: number
    /** "Tỷ lệ tích lũy / thu nhập" */
    accumulationRate: number
    incomeByCategory: Record<IncomeCategory, number>
    /** "Cơ cấu chi cả năm" */
    spendingByCategory: Record<SpendingCategory, number>
  }
  /** Months (1-12) that have at least one transaction. */
  activeMonths: number[]
}

export function buildYearReport(
  txns: readonly Txn[],
  year: number,
  options: { includeFundSpending?: boolean } = {},
): YearReport {
  const includeFundSpending = options.includeFundSpending ?? false
  const income = byCategory(INCOME_CATEGORIES)
  const spending = byCategory(SPENDING_CATEGORIES)
  const saving = zeros()
  const fundSpending = zeros()
  const active = new Set<number>()

  for (const t of txns) {
    if (yearOf(t.occurred_on) !== year) continue
    const m = monthOf(t.occurred_on) - 1
    active.add(m + 1)
    if (t.kind === 'income') {
      if (t.category in income) income[t.category as IncomeCategory][m] += t.amount
    } else if (t.category === 'saving') {
      saving[m] += t.amount
    } else if (t.category in spending) {
      spending[t.category as SpendingCategory][m] += t.amount
      if (t.from_savings) fundSpending[m] += t.amount
    }
  }

  const incomeTotal = addMonthly(...INCOME_CATEGORIES.map((c) => income[c]))
  const spendingTotal = addMonthly(...SPENDING_CATEGORIES.map((c) => spending[c]))
  const fullSurplus = zeros().map((_, i) => incomeTotal[i] - spendingTotal[i] - saving[i])
  const surplus = includeFundSpending ? fullSurplus : fullSurplus.map((v, i) => v + fundSpending[i])

  const incomeShare = byCategory(INCOME_CATEGORIES)
  for (const c of INCOME_CATEGORIES) {
    incomeShare[c] = income[c].map((v, i) => ratio(v, incomeTotal[i]))
  }
  const spendingShare = byCategory(SPENDING_CATEGORIES)
  const spendingAverage = {} as Record<SpendingCategory, number>
  for (const c of SPENDING_CATEGORIES) {
    spendingShare[c] = spending[c].map((v, i) => ratio(v, spendingTotal[i]))
    spendingAverage[c] = sum(spending[c]) / 12
  }

  const potentialSavingRate = incomeTotal.map((inc, i) => ratio(inc - spendingTotal[i], inc))
  const actualSavingRate = incomeTotal.map((inc, i) => (inc === 0 ? null : saving[i] / inc))

  const totalIncome = sum(incomeTotal)
  const totalSpending = sum(spendingTotal)
  const totalSaving = sum(saving)
  const totalSurplus = sum(surplus)
  const accumulation = totalSaving + sum(fullSurplus)

  const incomeByCategory = {} as Record<IncomeCategory, number>
  for (const c of INCOME_CATEGORIES) incomeByCategory[c] = sum(income[c])
  const spendingByCategory = {} as Record<SpendingCategory, number>
  for (const c of SPENDING_CATEGORIES) spendingByCategory[c] = sum(spending[c])

  return {
    year,
    income,
    incomeTotal,
    incomeShare,
    spending,
    spendingTotal,
    spendingShare,
    spendingAverage,
    saving,
    fundSpending,
    surplus,
    includesFundSpending: includeFundSpending,
    potentialSavingRate,
    actualSavingRate,
    totals: {
      income: totalIncome,
      spending: totalSpending,
      saving: totalSaving,
      fundSpending: sum(fundSpending),
      surplus: totalSurplus,
      avgIncome: totalIncome / 12,
      avgSpending: totalSpending / 12,
      accumulation,
      accumulationRate: ratio(accumulation, totalIncome),
      incomeByCategory,
      spendingByCategory,
    },
    activeMonths: [...active].sort((a, b) => a - b),
  }
}

export type ItemTotal = { item: string; total: number; share: number; count: number }

/**
 * "TOP KHOẢN CHI CHI TIẾT" — expense totals grouped by item name, largest first.
 * Unlike the workbook's fixed list, every item that was actually used is counted.
 * `share` is relative to the sum of the returned items.
 */
export function topExpenseItems(
  txns: readonly Txn[],
  year: number,
  options: { includeSaving?: boolean; month?: number } = {},
): ItemTotal[] {
  const groups = new Map<string, { total: number; count: number }>()
  for (const t of txns) {
    if (t.kind !== 'expense' || yearOf(t.occurred_on) !== year) continue
    if (!options.includeSaving && t.category === 'saving') continue
    if (options.month && monthOf(t.occurred_on) !== options.month) continue
    const entry = groups.get(t.item) ?? { total: 0, count: 0 }
    entry.total += t.amount
    entry.count += 1
    groups.set(t.item, entry)
  }
  const grandTotal = sum([...groups.values()].map((g) => g.total))
  return [...groups.entries()]
    .map(([item, g]) => ({ item, total: g.total, count: g.count, share: ratio(g.total, grandTotal) }))
    .sort((a, b) => b.total - a.total || a.item.localeCompare(b.item, 'vi'))
}

export type CutSummary = {
  /** Expenses marked "Muốn giảm" and their total. */
  count: number
  amount: number
  /** The period's spending (savings excluded) as it is, and as it would be without the marked expenses. */
  spendingBefore: number
  spendingAfter: number
  /** Income − spending − saving, as it is and without the marked expenses. */
  balanceBefore: number
  balanceAfter: number
  /** Marked amount as a share (0–1) of the period's spending. */
  share: number
  /** Each spending type: as it is and without the marked expenses. */
  byCategory: { category: SpendingCategory; before: number; after: number }[]
  /** Marked items, biggest first. */
  items: { item: string; count: number; amount: number }[]
}

/**
 * "What if I had not spent this": the period's spending with and without the expenses marked
 * "Muốn giảm". Pass the transactions of one period (a month, or a year).
 */
export function cutSummary(txns: readonly Txn[]): CutSummary {
  let income = 0
  let saving = 0
  let spendingBefore = 0
  let amount = 0
  let count = 0
  const before: Record<SpendingCategory, number> = { essential: 0, non_essential: 0, incidental: 0 }
  const marked: Record<SpendingCategory, number> = { essential: 0, non_essential: 0, incidental: 0 }
  const items = new Map<string, { count: number; amount: number }>()

  for (const t of txns) {
    if (t.kind === 'income') {
      income += t.amount
    } else if (t.category === 'saving') {
      saving += t.amount
    } else {
      const category = t.category as SpendingCategory
      spendingBefore += t.amount
      before[category] += t.amount
      if (t.cut_candidate) {
        amount += t.amount
        count += 1
        marked[category] += t.amount
        const entry = items.get(t.item) ?? { count: 0, amount: 0 }
        entry.count += 1
        entry.amount += t.amount
        items.set(t.item, entry)
      }
    }
  }

  const spendingAfter = spendingBefore - amount
  return {
    count,
    amount,
    spendingBefore,
    spendingAfter,
    balanceBefore: income - spendingBefore - saving,
    balanceAfter: income - spendingAfter - saving,
    share: ratio(amount, spendingBefore),
    byCategory: SPENDING_CATEGORIES.map((category) => ({ category, before: before[category], after: before[category] - marked[category] })),
    items: [...items.entries()]
      .map(([item, v]) => ({ item, ...v }))
      .sort((a, b) => b.amount - a.amount || a.item.localeCompare(b.item, 'vi')),
  }
}

/** Row 34 of "Phân loại thu chi": one item's amount per month. */
export function itemMonthly(txns: readonly Txn[], year: number, kind: Kind, item: string): Monthly {
  const result = zeros()
  for (const t of txns) {
    if (t.kind === kind && t.item === item && yearOf(t.occurred_on) === year) {
      result[monthOf(t.occurred_on) - 1] += t.amount
    }
  }
  return result
}

export type BudgetPlan = Record<BudgetCategory, Monthly>

export function buildBudgetPlan(rows: readonly BudgetRow[]): BudgetPlan {
  const plan = byCategory(BUDGET_CATEGORIES)
  for (const row of rows) {
    if (row.month >= 1 && row.month <= 12 && row.category in plan) {
      plan[row.category][row.month - 1] = row.amount
    }
  }
  return plan
}

type PlanActual<C extends string> = {
  planned: Record<C, Monthly>
  plannedTotal: Monthly
  actual: Record<C, Monthly>
  actualTotal: Monthly
  /** "CHÊNH LỆCH (Thực − Dự kiến)" */
  variance: Record<C, Monthly>
  varianceTotal: Monthly
}

function planActual<C extends string>(
  categories: readonly C[],
  planned: Record<C, Monthly>,
  actual: Record<C, Monthly>,
): PlanActual<C> {
  const variance = {} as Record<C, Monthly>
  for (const c of categories) variance[c] = actual[c].map((v, i) => v - planned[c][i])
  const plannedTotal = addMonthly(...categories.map((c) => planned[c]))
  const actualTotal = addMonthly(...categories.map((c) => actual[c]))
  return {
    planned,
    plannedTotal,
    actual,
    actualTotal,
    variance,
    varianceTotal: actualTotal.map((v, i) => v - plannedTotal[i]),
  }
}

export type BudgetComparison = {
  income: PlanActual<IncomeCategory>
  spending: PlanActual<SpendingCategory>
  saving: { planned: Monthly; actual: Monthly; variance: Monthly }
}

/** The whole "Lập ngân sách" sheet: dự kiến, thực tế and chênh lệch. */
export function compareBudget(plan: BudgetPlan, report: YearReport): BudgetComparison {
  const pick = <C extends BudgetCategory>(cats: readonly C[]) =>
    Object.fromEntries(cats.map((c) => [c, plan[c]])) as Record<C, Monthly>
  return {
    income: planActual(INCOME_CATEGORIES, pick(INCOME_CATEGORIES), report.income),
    spending: planActual(SPENDING_CATEGORIES, pick(SPENDING_CATEGORIES), report.spending),
    saving: {
      planned: plan.saving,
      actual: report.saving,
      variance: report.saving.map((v, i) => v - plan.saving[i]),
    },
  }
}

export type BudgetStatus = 'unplanned' | 'ok' | 'near' | 'over'

/** How much of a spending budget has been used. */
export function budgetStatus(actual: number, planned: number): { used: number; status: BudgetStatus } {
  if (planned <= 0) return { used: 0, status: actual > 0 ? 'unplanned' : 'ok' }
  const used = actual / planned
  return { used, status: used > 1 ? 'over' : used >= 0.8 ? 'near' : 'ok' }
}

/*
 * Budget warnings: a spending group that has used 80% of its monthly plan, or gone over it. The
 * thresholds are `budgetStatus`'s, so warnings always agree with the budget meters. Savings are a
 * target, not a cap, and never warn.
 */
export type BudgetAlertLevel = 'near' | 'over'

export type BudgetAlert = {
  category: SpendingCategory
  level: BudgetAlertLevel
  actual: number
  planned: number
  /** actual / planned (1 = 100%). */
  used: number
}

const ALERT_RANK: Record<BudgetStatus, number> = { ok: 0, unplanned: 0, near: 1, over: 2 }

/** Groups at or past the warning threshold, the worst first. Groups without a plan are skipped. */
export function budgetAlerts(byCategory: Record<SpendingCategory, { actual: number; planned: number }>): BudgetAlert[] {
  const alerts: BudgetAlert[] = []
  for (const category of SPENDING_CATEGORIES) {
    const { actual, planned } = byCategory[category]
    const { used, status } = budgetStatus(actual, planned)
    if (status === 'near' || status === 'over') alerts.push({ category, level: status, actual, planned, used })
  }
  return alerts.sort((a, b) => ALERT_RANK[b.level] - ALERT_RANK[a.level] || b.used - a.used)
}

/**
 * The level a group just reached when its spending went from `before` to `after`, or `null` when
 * nothing new happened. Only crossing a threshold counts (ok → 80%, anything → over), so logging
 * one more coffee in a group that is already at 85% does not warn again.
 */
export function crossedThreshold(before: number, after: number, planned: number): BudgetAlertLevel | null {
  if (planned <= 0) return null
  const from = budgetStatus(before, planned).status
  const to = budgetStatus(after, planned).status
  if (to !== 'near' && to !== 'over') return null
  return ALERT_RANK[to] > ALERT_RANK[from] ? to : null
}

/** A stable fingerprint of the current warnings, so a dismissed banner comes back when something new is reached. */
export function alertsSignature(alerts: readonly BudgetAlert[]): string {
  return alerts
    .map((a) => `${a.category}:${a.level}`)
    .sort()
    .join(',')
}

export type MonthSnapshot = {
  month: number
  income: number
  spending: number
  saving: number
  /** Spending paid from goals this month (part of `spending`). */
  fundSpending: number
  surplus: number
  potentialSavingRate: number
  actualSavingRate: number | null
  planned: { income: number; spending: number; saving: number }
  spendingByCategory: Record<SpendingCategory, { actual: number; planned: number }>
}

export function monthSnapshot(report: YearReport, plan: BudgetPlan, month: number): MonthSnapshot {
  const i = month - 1
  const spendingByCategory = {} as MonthSnapshot['spendingByCategory']
  for (const c of SPENDING_CATEGORIES) {
    spendingByCategory[c] = { actual: report.spending[c][i], planned: plan[c][i] }
  }
  return {
    month,
    income: report.incomeTotal[i],
    spending: report.spendingTotal[i],
    saving: report.saving[i],
    fundSpending: report.fundSpending[i],
    surplus: report.surplus[i],
    potentialSavingRate: report.potentialSavingRate[i],
    actualSavingRate: report.actualSavingRate[i],
    planned: {
      income: sum(INCOME_CATEGORIES.map((c) => plan[c][i])),
      spending: sum(SPENDING_CATEGORIES.map((c) => plan[c][i])),
      saving: plan.saving[i],
    },
    spendingByCategory,
  }
}
