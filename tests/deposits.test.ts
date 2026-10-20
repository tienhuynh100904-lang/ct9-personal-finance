import assert from 'node:assert/strict'
import { test } from 'node:test'
import { depositView, depositsOverSavings, expectedInterest, maturityOf, sortedDeposits, summarizeDeposits, type DepositRecord } from '../lib/deposits.ts'

const deposit = (id: string, start: string, term: number, over: Partial<DepositRecord> = {}): DepositRecord => ({
  id,
  name: `Khoản ${id}`,
  principal: 10_000_000,
  rate_bp: 600,
  start_date: start,
  term_months: term,
  note: null,
  closed_on: null,
  ...over,
})

test('maturity is the start date plus the term, clamped to the month end', () => {
  assert.equal(maturityOf({ start_date: '2026-01-15', term_months: 6 }), '2026-07-15')
  assert.equal(maturityOf({ start_date: '2026-08-31', term_months: 6 }), '2027-02-28')
  assert.equal(maturityOf({ start_date: '2026-03-10', term_months: 12 }), '2027-03-10')
})

test('interest is simple: principal × rate × days / 365', () => {
  // 10 triệu, 6%/năm, 365 ngày → 600.000
  assert.equal(expectedInterest(deposit('a', '2026-03-10', 12)), 600_000)
  assert.equal(expectedInterest(deposit('b', '2026-03-10', 12, { rate_bp: 0 })), 0)
})

test('state: matured, soon, later and closed', () => {
  const today = '2026-10-20'
  assert.equal(depositView(deposit('a', '2026-04-20', 6), today).state, 'matured') // matures today
  assert.equal(depositView(deposit('b', '2026-03-10', 6), today).state, 'matured') // 40 days ago
  assert.equal(depositView(deposit('c', '2026-04-25', 6), today).state, 'soon') // in 5 days
  assert.equal(depositView(deposit('d', '2026-10-01', 6), today).state, 'later')
  assert.equal(depositView(deposit('e', '2026-04-20', 6, { closed_on: '2026-10-20' }), today).state, 'closed')
  assert.equal(depositView(deposit('c', '2026-04-25', 6), today).daysLeft, 5)
  assert.equal(depositView(deposit('b', '2026-03-10', 6), today).daysLeft, -40)
})

test('sorting: matured first, then by maturity, settled last', () => {
  const today = '2026-10-20'
  const list = [
    deposit('later', '2026-10-01', 12),
    deposit('closed', '2026-01-01', 6, { closed_on: '2026-07-01' }),
    deposit('soon', '2026-04-25', 6),
    deposit('matured', '2026-03-10', 6),
  ]
  assert.deepEqual(sortedDeposits(list, today).map((v) => v.deposit.id), ['matured', 'soon', 'later', 'closed'])
})

test('summary counts only open deposits', () => {
  const today = '2026-10-20'
  const summary = summarizeDeposits([deposit('a', '2026-04-25', 6), deposit('b', '2026-10-01', 12), deposit('c', '2026-01-01', 6, { closed_on: '2026-07-01' })], today)
  assert.equal(summary.open.length, 2)
  assert.equal(summary.principal, 20_000_000)
  assert.equal(summary.next?.deposit.id, 'a')
  assert.equal(summary.attention, 1)
})

test('deposits above what was saved are flagged, spending from goals is not counted as saved', () => {
  assert.equal(depositsOverSavings(10_000_000, 15_000_000, 0), 0)
  assert.equal(depositsOverSavings(10_000_000, 15_000_000, 8_000_000), 3_000_000)
  assert.equal(depositsOverSavings(0, 0, 0), 0)
})

test('progress runs from the deposit date to the maturity date', () => {
  const d = deposit('a', '2026-01-01', 6) // 181 days to 2026-07-01
  assert.equal(depositView(d, '2025-12-20').progress, 0)
  assert.equal(depositView(d, '2026-01-01').progress, 0)
  assert.equal(depositView(d, '2026-07-01').progress, 1)
  assert.equal(depositView(d, '2026-10-20').progress, 1)
  const mid = depositView(d, '2026-04-02')
  assert.equal(mid.termDays, 181)
  assert.equal(mid.daysElapsed, 91)
  assert.ok(Math.abs(mid.progress - 91 / 181) < 1e-9)
})
