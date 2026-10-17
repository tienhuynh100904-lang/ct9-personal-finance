import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  accrue,
  unallocated,
  emergencyTarget,
  feasibility,
  goalProgress,
  monthlyFromNow,
  plannedMonthly,
  pmt,
  wholeMonthsBetween,
  withdrawable,
  type GoalRecord,
} from '../lib/goals.ts'

/** The workbook's "Ví dụ" sheet: "Đi du lịch", 10 triệu in 12 months from 01/03/2026 at 4%/năm. */
const EXAMPLE_DEPOSITS = [
  { date: '2026-03-01', amount: 816_000 },
  { date: '2026-04-10', amount: 200_000 },
  { date: '2026-05-05', amount: 300_000 },
  { date: '2026-05-20', amount: 200_000 },
  { date: '2026-06-12', amount: 200_000 },
  { date: '2026-07-08', amount: 200_000 },
  { date: '2026-07-15', amount: 100_000 },
  { date: '2026-08-01', amount: 816_000 },
]

const near = (actual: number, expected: number, digits = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≉ ${expected}`)

test('PMT matches Excel, including the zero-rate case', () => {
  near(pmt(0.04 / 12, 12, 0, 10_000_000, 1), -815_447.55, 1)
  assert.equal(pmt(0, 10, 0, 1_000_000, 1), -100_000)
})

test('the planned monthly amount is the workbook\'s 816.000 ₫', () => {
  assert.equal(plannedMonthly({ target: 10_000_000, months: 12, rateBp: 400, existing: 0 }), 816_000)
  // Money already set aside lowers it; a goal already covered needs nothing.
  assert.ok(plannedMonthly({ target: 10_000_000, months: 12, rateBp: 400, existing: 2_000_000 }) < 816_000)
  assert.equal(plannedMonthly({ target: 1_000_000, months: 6, rateBp: 0, existing: 1_000_000 }), 0)
  assert.equal(plannedMonthly({ target: 1_200_000, months: 12, rateBp: 0, existing: 0 }), 100_000)
})

test('the balance with daily interest matches the workbook to the đồng', () => {
  const result = accrue(EXAMPLE_DEPOSITS, 400, '2026-08-01')
  assert.equal(result.principal, 2_832_000)
  near(result.interest, 22_585.45)
  near(result.balance, 2_854_585.45)
  // Interest keeps running after the last deposit; future deposits are ignored.
  assert.ok(accrue(EXAMPLE_DEPOSITS, 400, '2026-09-01').balance > result.balance)
  assert.equal(accrue([{ date: '2026-12-01', amount: 5 }], 400, '2026-08-01').balance, 0)
})

test('what you get back depends on where the fund is kept', () => {
  const a = { principal: 1_000_000, interest: 10_000, balance: 1_010_000 }
  assert.equal(withdrawable(a, 'bank'), 1_010_000)
  assert.equal(withdrawable(a, 'app'), 1_009_500)
  near(withdrawable(a, 'mmf'), 1_008_990)
})

test('"cần tiết kiệm các tháng sau" matches the workbook\'s column I', () => {
  const deadline = '2027-03-01'
  // After the first deposit (March), the deposit of April, and the last one (August).
  assert.equal(monthlyFromNow({ target: 10_000_000, balance: 819_576.99, rateBp: 400, deadline, today: '2026-03-01' }).amount, 815_000)
  assert.equal(monthlyFromNow({ target: 10_000_000, balance: 1_022_370.35, rateBp: 400, deadline, today: '2026-04-10' }).amount, 878_000)
  assert.equal(monthlyFromNow({ target: 10_000_000, balance: 2_854_585.45, rateBp: 400, deadline, today: '2026-08-01' }).amount, 1_168_000)
  // The last month asks for the whole remainder; reaching the target means done.
  assert.equal(monthlyFromNow({ target: 10_000_000, balance: 9_000_000, rateBp: 400, deadline, today: '2027-02-10' }).amount, 1_000_000)
  assert.equal(monthlyFromNow({ target: 10_000_000, balance: 10_000_000, rateBp: 400, deadline, today: '2026-09-01' }).done, true)
})

test('whole months follow Excel DATEDIF', () => {
  assert.equal(wholeMonthsBetween('2026-08-31', '2027-03-01'), 6)
  assert.equal(wholeMonthsBetween('2026-03-31', '2027-03-01'), 11)
  assert.equal(wholeMonthsBetween('2027-04-01', '2027-03-01'), 0)
})

const goal = (patch: Partial<GoalRecord> = {}): GoalRecord => ({
  id: 'g1',
  kind: 'custom',
  name: 'Đi du lịch',
  target_amount: 10_000_000,
  monthly_expense: null,
  reserve_months: null,
  start_date: '2026-03-01',
  months: 12,
  rate_bp: 400,
  place: 'bank',
  initial_amount: 0,
  note: null,
  archived_at: null,
  ...patch,
})

test('a goal\'s progress, pace and milestones', () => {
  const allocations = EXAMPLE_DEPOSITS.map((d, i) => ({ id: `a${i}`, goal_id: 'g1', amount: d.amount, allocated_on: d.date, note: null, created_at: '', transaction_id: null }))
  const p = goalProgress(goal(), allocations, '2026-08-01')
  assert.equal(p.deadline, '2027-03-01')
  assert.equal(p.allocated, 2_832_000)
  near(p.progress, 0.2854585, 6)
  assert.equal(p.planned, 816_000)
  assert.equal(p.fromNow.amount, 1_168_000)
  // Five months in, an even pace would be ~4,2 triệu: behind, and only the 25% milestone is reached.
  assert.equal(p.pace, 'behind')
  assert.deepEqual(p.milestones.map((m) => [m.share, m.date, m.reached]), [
    [0.25, '2026-06-01', true],
    [0.5, '2026-09-01', false],
    [0.75, '2026-12-01', false],
    [1, '2027-03-01', false],
  ])
  // Allocations of other goals are not counted; the existing amount is.
  assert.equal(goalProgress(goal({ initial_amount: 10_000_000 }), [], '2026-03-02').pace, 'done')
  assert.equal(goalProgress(goal(), [], '2026-02-01').pace, 'not_started')
  assert.equal(goalProgress(goal(), [], '2027-04-01').pace, 'overdue')
})

test('emergency target and the plan\'s feasibility', () => {
  assert.equal(emergencyTarget(8_000_000, 6), 48_000_000)
  assert.equal(feasibility(5_000_000, 4_000_000), 'not_feasible')
  assert.equal(feasibility(3_500_000, 4_000_000), 'feasible')
  assert.equal(feasibility(1_000_000, 4_000_000), 'very_feasible')
  assert.equal(feasibility(1_000_000, 0), 'unknown')
})

test('spending from a goal leaves the unallocated pool alone; a withdrawal fills it', () => {
  // Saved 35 triệu, put 10 into the trip fund.
  assert.equal(unallocated({ saved: 35_000_000, spent: 0, allocated: 10_000_000 }), 25_000_000)
  // Spend 6 triệu straight from the fund: the fund drops to 4, the pool stays at 25.
  assert.equal(unallocated({ saved: 35_000_000, spent: 6_000_000, allocated: 4_000_000 }), 25_000_000)
  // Withdraw the remaining 4 instead: it comes back to the pool.
  assert.equal(unallocated({ saved: 35_000_000, spent: 6_000_000, allocated: 0 }), 29_000_000)
})

test('a goal tells allocations, withdrawals and spending apart', () => {
  const rows = [
    { id: 'a', goal_id: 'g1', amount: 10_000_000, allocated_on: '2026-04-01', note: null, created_at: '', transaction_id: null },
    { id: 'b', goal_id: 'g1', amount: -1_000_000, allocated_on: '2026-05-01', note: null, created_at: '', transaction_id: null },
    { id: 'c', goal_id: 'g1', amount: -6_000_000, allocated_on: '2026-06-01', note: null, created_at: '', transaction_id: 't1' },
  ]
  const p = goalProgress(goal({ rate_bp: 0 }), rows, '2026-07-01')
  assert.equal(p.allocated, 3_000_000)
  assert.equal(p.spent, 6_000_000)
  assert.equal(p.accrual.balance, 3_000_000)
})
