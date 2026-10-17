// Run with `npm test` (Node's built-in test runner; types are stripped natively).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  budgetStatus,
  buildBudgetPlan,
  buildYearReport,
  compareBudget,
  itemMonthly,
  monthSnapshot,
  topExpenseItems,
  type Txn,
} from '../lib/finance.ts'

const txns: Txn[] = [
  { kind: 'income', item: 'Lương', category: 'main', amount: 10_000_000, occurred_on: '2026-03-05' },
  { kind: 'income', item: 'Freelance', category: 'side', amount: 2_000_000, occurred_on: '2026-03-20' },
  { kind: 'expense', item: 'Ăn uống', category: 'essential', amount: 3_000_000, occurred_on: '2026-03-10' },
  { kind: 'expense', item: 'Giải trí', category: 'non_essential', amount: 1_000_000, occurred_on: '2026-03-11' },
  { kind: 'expense', item: 'Sửa xe', category: 'incidental', amount: 500_000, occurred_on: '2026-03-12' },
  { kind: 'expense', item: 'Tiết kiệm', category: 'saving', amount: 4_000_000, occurred_on: '2026-03-28' },
  { kind: 'expense', item: 'Ăn uống', category: 'non_essential', amount: 600_000, occurred_on: '2026-04-02' },
  // Other years never leak into the report (Excel's MONTH() ignored the year).
  { kind: 'income', item: 'Lương', category: 'main', amount: 9_000_000, occurred_on: '2025-03-05' },
]

describe('buildYearReport (sheet "Phân loại thu chi")', () => {
  const r = buildYearReport(txns, 2026)

  test('income by category and total', () => {
    assert.equal(r.income.main[2], 10_000_000)
    assert.equal(r.income.side[2], 2_000_000)
    assert.equal(r.incomeTotal[2], 12_000_000)
    assert.equal(r.totals.income, 12_000_000)
  })

  test('spending excludes savings; surplus = income − spending − saving', () => {
    assert.equal(r.spendingTotal[2], 4_500_000)
    assert.equal(r.saving[2], 4_000_000)
    assert.equal(r.surplus[2], 12_000_000 - 4_500_000 - 4_000_000)
    assert.equal(r.surplus[3], -600_000)
  })

  test('shares use IFERROR(x / total, 0)', () => {
    assert.equal(r.incomeShare.main[2], 10 / 12)
    assert.equal(r.incomeShare.main[0], 0)
    assert.equal(r.spendingShare.essential[2], 3 / 4.5)
  })

  test('saving rates', () => {
    assert.equal(r.potentialSavingRate[2], (12 - 4.5) / 12)
    assert.equal(r.actualSavingRate[2], 4 / 12)
    assert.equal(r.actualSavingRate[3], null) // Excel: #DIV/0!
    assert.equal(r.potentialSavingRate[3], 0)
  })

  test('year overview divides by 12 like the workbook', () => {
    assert.equal(r.totals.avgIncome, 1_000_000)
    assert.equal(r.spendingAverage.essential, 250_000)
    assert.equal(r.totals.accumulation, r.totals.saving + r.totals.surplus)
    assert.deepEqual(r.activeMonths, [3, 4])
  })
})

test('topExpenseItems groups every used item and can exclude savings', () => {
  const all = topExpenseItems(txns, 2026, { includeSaving: true })
  assert.equal(all[0].item, 'Tiết kiệm')
  const spending = topExpenseItems(txns, 2026)
  assert.deepEqual(
    spending.map((i) => [i.item, i.total, i.count]),
    [
      ['Ăn uống', 3_600_000, 2],
      ['Giải trí', 1_000_000, 1],
      ['Sửa xe', 500_000, 1],
    ],
  )
  assert.equal(topExpenseItems(txns, 2026, { month: 4 })[0].total, 600_000)
})

test('itemMonthly returns one item per month', () => {
  const values = itemMonthly(txns, 2026, 'expense', 'Ăn uống')
  assert.equal(values[2], 3_000_000)
  assert.equal(values[3], 600_000)
})

describe('budget (sheet "Lập ngân sách")', () => {
  const plan = buildBudgetPlan([
    { month: 3, category: 'main', amount: 11_000_000 },
    { month: 3, category: 'essential', amount: 2_500_000 },
    { month: 3, category: 'saving', amount: 5_000_000 },
  ])
  const report = buildYearReport(txns, 2026)
  const cmp = compareBudget(plan, report)

  test('variance = actual − planned', () => {
    assert.equal(cmp.income.variance.main[2], -1_000_000)
    assert.equal(cmp.income.varianceTotal[2], 1_000_000)
    assert.equal(cmp.spending.variance.essential[2], 500_000)
    assert.equal(cmp.saving.variance[2], -1_000_000)
  })

  test('month snapshot', () => {
    const s = monthSnapshot(report, plan, 3)
    assert.equal(s.planned.income, 11_000_000)
    assert.deepEqual(s.spendingByCategory.essential, { actual: 3_000_000, planned: 2_500_000 })
  })

  test('budgetStatus thresholds', () => {
    assert.equal(budgetStatus(500, 1000).status, 'ok')
    assert.equal(budgetStatus(800, 1000).status, 'near')
    assert.equal(budgetStatus(1001, 1000).status, 'over')
    assert.equal(budgetStatus(10, 0).status, 'unplanned')
  })
})

test('spending paid from a goal is left out of the surplus unless asked for', () => {
  const txns = [
    { kind: 'income' as const, item: 'Lương', category: 'main' as const, amount: 10_000_000, occurred_on: '2026-03-05' },
    { kind: 'expense' as const, item: 'Ăn uống', category: 'essential' as const, amount: 3_000_000, occurred_on: '2026-03-10' },
    { kind: 'expense' as const, item: 'Gửi tiết kiệm', category: 'saving' as const, amount: 2_000_000, occurred_on: '2026-03-11' },
    { kind: 'expense' as const, item: 'Vé máy bay', category: 'non_essential' as const, amount: 6_000_000, occurred_on: '2026-03-20', from_savings: true },
  ]
  const excluded = buildYearReport(txns, 2026)
  const included = buildYearReport(txns, 2026, { includeFundSpending: true })
  // The trip is real spending either way…
  assert.equal(excluded.spendingTotal[2], 9_000_000)
  assert.equal(excluded.fundSpending[2], 6_000_000)
  // …but by default it does not eat the month's surplus: it was paid with money saved earlier.
  assert.equal(excluded.surplus[2], 10_000_000 - 3_000_000 - 2_000_000)
  assert.equal(included.surplus[2], 10_000_000 - 9_000_000 - 2_000_000)
  assert.equal(excluded.includesFundSpending, false)
  // What the year really added (income − spending) does not depend on the choice.
  assert.equal(excluded.totals.accumulation, 1_000_000)
  assert.equal(included.totals.accumulation, 1_000_000)
})
