import assert from 'node:assert/strict'
import { test } from 'node:test'
import { confirmDate, dueDate, recurringForMonth, type RecurringRecord } from '../lib/recurring.ts'

const rule = (id: string, item: string, day: number, active = true): RecurringRecord => ({
  id,
  kind: 'expense',
  item_id: `item-${item}`,
  item,
  category: 'essential',
  amount: 100_000,
  day_of_month: day,
  note: null,
  active,
})

test('day 31 falls on the last day of shorter months', () => {
  assert.equal(dueDate(2026, 10, 31), '2026-10-31')
  assert.equal(dueDate(2026, 11, 31), '2026-11-30')
  assert.equal(dueDate(2026, 2, 30), '2026-02-28')
  assert.equal(dueDate(2028, 2, 31), '2028-02-29')
  assert.equal(dueDate(2026, 1, 5), '2026-01-05')
})

test('confirming late keeps the due date, confirming early uses today', () => {
  assert.equal(confirmDate('2026-10-01', '2026-10-14'), '2026-10-01')
  assert.equal(confirmDate('2026-10-25', '2026-10-14'), '2026-10-14')
  assert.equal(confirmDate('2026-10-14', '2026-10-14'), '2026-10-14')
})

test('states for the month: due, upcoming, done and skipped, actionable first', () => {
  const rules = [rule('a', 'Lương', 25), rule('b', 'Tiền nhà', 1), rule('c', 'Wifi', 10), rule('d', 'Điện', 5), rule('e', 'Gym', 3, false)]
  const runs = [
    { recurring_id: 'c', status: 'done' as const, transaction_id: 't1' },
    { recurring_id: 'd', status: 'skipped' as const, transaction_id: null },
  ]
  const month = recurringForMonth(rules, runs, '2026-10-14')
  assert.deepEqual(
    month.map((m) => [m.rule.item, m.state, m.due]),
    [
      ['Tiền nhà', 'due', '2026-10-01'],
      ['Lương', 'upcoming', '2026-10-25'],
      ['Điện', 'skipped', '2026-10-05'],
      ['Wifi', 'done', '2026-10-10'],
    ],
  )
  assert.equal(month.find((m) => m.rule.id === 'c')?.transactionId, 't1')
})

test('a rule due today is due, not upcoming', () => {
  assert.equal(recurringForMonth([rule('a', 'Tiền nhà', 14)], [], '2026-10-14')[0].state, 'due')
})
