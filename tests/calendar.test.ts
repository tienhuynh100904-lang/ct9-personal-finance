import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addMonths, longDateLabel, monthGrid } from '../lib/calendar.ts'

test('october 2026 starts on a Thursday and is laid out Monday first', () => {
  const weeks = monthGrid(2026, 10)
  assert.deepEqual(weeks[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  assert.equal(weeks.length, 5)
  assert.ok(weeks.every((w) => w.length === 7))
  assert.equal(weeks.flat().filter(Boolean).length, 31)
})

test('a month that starts on Sunday needs six weeks', () => {
  const weeks = monthGrid(2026, 2) // 1 Feb 2026 is a Sunday
  assert.equal(weeks[0][6], '2026-02-01')
  assert.equal(weeks.flat().filter(Boolean).length, 28)
  assert.equal(monthGrid(2026, 3).length, 6) // 1 Mar 2026 is a Sunday too, 31 days
})

test('addMonths clamps the day and crosses years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15')
  assert.equal(addMonths('2026-03-10', -15), '2024-12-10')
})

test('long label names the weekday', () => {
  assert.equal(longDateLabel('2026-10-12'), 'Thứ hai, 12/10/2026')
  assert.equal(longDateLabel('2026-10-04'), 'Chủ nhật, 04/10/2026')
})
