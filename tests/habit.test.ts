import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { BudgetRow, Txn } from '../lib/finance.ts'
import {
  addDays,
  buildDayLog,
  dailyAllowance,
  greeting,
  habitWindowStart,
  loggingStreak,
  monthCoverage,
  recentGap,
  recentPresets,
  weekCells,
} from '../lib/habit.ts'

const expense = (day: string, amount: number, item = 'Ăn uống', category: Txn['category'] = 'essential'): Txn => ({
  kind: 'expense',
  item,
  category,
  amount,
  occurred_on: day,
})
const income = (day: string, amount: number): Txn => ({ kind: 'income', item: 'Lương', category: 'main', amount, occurred_on: day })

const TODAY = '2026-10-13' // a Tuesday
const START = '2026-08-12'

describe('dates', () => {
  test('addDays crosses month and year boundaries', () => {
    assert.equal(addDays('2026-10-01', -1), '2026-09-30')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  })
  test('window starts 62 days back, before the 1st of the month', () => {
    assert.equal(habitWindowStart('2026-10-13'), '2026-08-12')
    assert.equal(habitWindowStart('2026-01-05'), '2025-11-04')
  })
})

describe('loggingStreak', () => {
  test('counts consecutive days ending today', () => {
    const log = buildDayLog([expense('2026-10-13', 1000), expense('2026-10-12', 1000), income('2026-10-11', 1000)], [])
    const s = loggingStreak(log, TODAY, START)
    assert.equal(s.current, 3)
    assert.equal(s.todayLogged, true)
  })

  test('an empty today never breaks the streak (counted back from yesterday)', () => {
    const log = buildDayLog([expense('2026-10-12', 1000), expense('2026-10-11', 1000)], [])
    const s = loggingStreak(log, TODAY, START)
    assert.equal(s.current, 2)
    assert.equal(s.todayLogged, false)
  })

  test('a gap ends the streak', () => {
    const log = buildDayLog([expense('2026-10-13', 1), expense('2026-10-12', 1), expense('2026-10-10', 1)], [])
    assert.equal(loggingStreak(log, TODAY, START).current, 2)
  })

  test('a "không chi tiêu" mark keeps the streak alive', () => {
    const log = buildDayLog([expense('2026-10-13', 1), expense('2026-10-11', 1)], ['2026-10-12'])
    assert.equal(loggingStreak(log, TODAY, START).current, 3)
  })

  test('future-dated transactions are ignored', () => {
    const log = buildDayLog([expense('2026-10-14', 1), expense('2026-10-15', 1)], [])
    const s = loggingStreak(log, TODAY, START)
    assert.equal(s.current, 0)
    assert.equal(s.anyLogged, false)
  })

  test('a streak reaching the window start is reported as capped', () => {
    const days = Array.from({ length: 70 }, (_, i) => expense(addDays(TODAY, -i), 1))
    const s = loggingStreak(buildDayLog(days, []), TODAY, START)
    assert.equal(s.capped, true)
    assert.equal(s.current, 63)
  })

  test('no data at all', () => {
    const s = loggingStreak(buildDayLog([], []), TODAY, START)
    assert.deepEqual(s, { current: 0, capped: false, todayLogged: false, anyLogged: false })
  })
})

describe('recentGap', () => {
  test('counts unlogged days ending yesterday and notes an earlier log', () => {
    const log = buildDayLog([expense('2026-10-09', 1)], [])
    assert.deepEqual(recentGap(log, TODAY, START), { days: 3, hasEarlierLog: true })
  })
  test('yesterday logged means no gap', () => {
    const log = buildDayLog([expense('2026-10-12', 1)], [])
    assert.equal(recentGap(log, TODAY, START).days, 0)
  })
  test('a brand-new account has a gap but no earlier log', () => {
    const r = recentGap(buildDayLog([], []), TODAY, '2026-10-01')
    assert.equal(r.hasEarlierLog, false)
  })
})

describe('monthCoverage', () => {
  test('on the 1st nothing has fully passed yet', () => {
    assert.deepEqual(monthCoverage(buildDayLog([], []), '2026-10-01'), { logged: 0, elapsed: 0 })
  })
  test('today pending is not counted as elapsed', () => {
    const log = buildDayLog([expense('2026-10-12', 1), expense('2026-10-10', 1)], [])
    assert.deepEqual(monthCoverage(log, TODAY), { logged: 2, elapsed: 12 })
  })
  test('today logged counts', () => {
    const log = buildDayLog([expense('2026-10-13', 1)], [])
    assert.deepEqual(monthCoverage(log, TODAY), { logged: 1, elapsed: 13 })
  })
})

describe('weekCells', () => {
  test('rolling 7 days ending today, Monday-first labels follow the weekday', () => {
    const cells = weekCells(buildDayLog([expense('2026-10-12', 1)], ['2026-10-11']), TODAY)
    assert.equal(cells.length, 7)
    assert.equal(cells[6].iso, TODAY)
    assert.deepEqual(cells.map((c) => c.label), ['T4', 'T5', 'T6', 'T7', 'CN', 'T2', 'T3'])
    assert.equal(cells[6].state, 'pending')
    assert.equal(cells[5].state, 'logged')
    assert.equal(cells[4].state, 'no_spend')
    assert.equal(cells[0].state, 'empty')
  })
  test('a transaction wins over a mark on the same day', () => {
    const cells = weekCells(buildDayLog([expense(TODAY, 5)], [TODAY]), TODAY)
    assert.equal(cells[6].state, 'logged')
  })
  test('is stable on a Monday (no future cells)', () => {
    const cells = weekCells(buildDayLog([], []), '2026-10-12')
    assert.equal(cells[6].label, 'T2')
    assert.ok(cells.every((c) => c.iso <= '2026-10-12'))
  })
})

describe('dailyAllowance', () => {
  const budget = (essential: number, non = 0, incidental = 0): BudgetRow[] => [
    { month: 10, category: 'essential', amount: essential },
    { month: 10, category: 'non_essential', amount: non },
    { month: 10, category: 'incidental', amount: incidental },
    { month: 10, category: 'saving', amount: 9_000_000 }, // savings never count as spending budget
    { month: 11, category: 'essential', amount: 99_000_000 }, // other months are ignored
  ]

  test('no budget set', () => {
    const a = dailyAllowance({ txns: [expense(TODAY, 40_000)], monthBudget: [], today: TODAY })
    assert.equal(a.status, 'no_budget')
    assert.equal(a.spentToday, 40_000)
    assert.equal(a.todayCount, 1)
  })

  test('ok: spreads what is left over the remaining days and rounds down to 1.000', () => {
    // 3.1M budget, 500k spent before today → 2.6M over 19 days (13..31) = 136,842 → 136.000
    const a = dailyAllowance({ txns: [expense('2026-10-05', 500_000)], monthBudget: budget(2_000_000, 700_000, 400_000), today: TODAY })
    assert.equal(a.status, 'ok')
    assert.equal(a.daysLeft, 19)
    assert.equal(a.allowance, 136_000)
    assert.equal(a.remainingToday, 136_000)
  })

  test('logging an expense lowers what is left today, the allowance itself is stable', () => {
    const before = dailyAllowance({ txns: [], monthBudget: budget(3_100_000), today: TODAY })
    const after = dailyAllowance({ txns: [expense(TODAY, 50_000)], monthBudget: budget(3_100_000), today: TODAY })
    assert.equal(after.allowance, before.allowance)
    assert.equal(after.remainingToday, before.remainingToday - 50_000)
  })

  test('over_today: spent more than the suggestion but the month is still fine', () => {
    const a = dailyAllowance({ txns: [expense(TODAY, 500_000)], monthBudget: budget(3_100_000), today: TODAY })
    assert.equal(a.status, 'over_today')
    assert.equal(a.overBy, 500_000 - a.allowance)
    assert.equal(a.remainingToday, 0)
  })

  test('month_over: budget exhausted', () => {
    const a = dailyAllowance({ txns: [expense('2026-10-02', 3_500_000)], monthBudget: budget(3_000_000), today: TODAY })
    assert.equal(a.status, 'month_over')
    assert.equal(a.allowance, 0)
    assert.equal(a.remainingToday, 0)
  })

  test('month_over with exactly zero left reports no overshoot', () => {
    const a = dailyAllowance({ txns: [expense('2026-10-02', 3_000_000)], monthBudget: budget(3_000_000), today: TODAY })
    assert.equal(a.status, 'month_over')
    assert.equal(a.overBy, 0)
  })

  test('savings and income do not count as spending', () => {
    const a = dailyAllowance({
      txns: [expense(TODAY, 4_000_000, 'Tiết kiệm', 'saving'), income(TODAY, 9_000_000)],
      monthBudget: budget(3_100_000),
      today: TODAY,
    })
    assert.equal(a.spentToday, 0)
    assert.equal(a.todayCount, 2) // they still count as logged entries
  })

  test('last day of the month: all that is left is today', () => {
    const a = dailyAllowance({ txns: [expense('2026-10-30', 1_000_000)], monthBudget: budget(1_500_000), today: '2026-10-31' })
    assert.equal(a.daysLeft, 1)
    assert.equal(a.allowance, 500_000)
  })

  test('future-dated spending is not counted', () => {
    const a = dailyAllowance({ txns: [expense('2026-10-20', 2_000_000)], monthBudget: budget(3_100_000), today: TODAY })
    assert.equal(a.allowance, Math.floor(3_100_000 / 19 / 1000) * 1000)
  })
})

describe('recentPresets', () => {
  const t = (day: string, item: string, amount: number, created = ''): Txn & { created_at: string } => ({
    ...expense(day, amount, item),
    created_at: created,
  })

  test('ranks by frequency, then recency, using the latest amount', () => {
    const presets = recentPresets(
      [t('2026-10-01', 'Cà phê', 30_000), t('2026-10-05', 'Cà phê', 35_000), t('2026-10-12', 'Cà phê', 40_000), t('2026-10-12', 'Phở', 50_000), t('2026-10-02', 'Grab', 90_000)],
      TODAY,
    )
    assert.deepEqual(presets.map((p) => [p.item, p.amount, p.count]), [
      ['Cà phê', 40_000, 3],
      ['Phở', 50_000, 1],
      ['Grab', 90_000, 1],
    ])
  })

  test('ignores old, future, income and savings entries', () => {
    const presets = recentPresets(
      [t('2026-08-01', 'Cũ', 1), t('2026-10-20', 'Tương lai', 1), income(TODAY, 5) as never, { ...expense(TODAY, 5, 'Tiết kiệm', 'saving'), created_at: '' }],
      TODAY,
    )
    assert.deepEqual(presets, [])
  })
})

test('greeting by hour', () => {
  assert.equal(greeting(7), 'Chào buổi sáng')
  assert.equal(greeting(12), 'Chào buổi trưa')
  assert.equal(greeting(16), 'Chào buổi chiều')
  assert.equal(greeting(21), 'Chào buổi tối')
  assert.equal(greeting(2), 'Chào buổi tối')
})
