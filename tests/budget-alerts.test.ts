import assert from 'node:assert/strict'
import { test } from 'node:test'
import { alertsSignature, budgetAlerts, crossedThreshold } from '../lib/finance.ts'

const groups = (essential: [number, number], non_essential: [number, number], incidental: [number, number]) => ({
  essential: { actual: essential[0], planned: essential[1] },
  non_essential: { actual: non_essential[0], planned: non_essential[1] },
  incidental: { actual: incidental[0], planned: incidental[1] },
})

test('only groups at 80% or over warn, the worst first', () => {
  const alerts = budgetAlerts(groups([850, 1000], [500, 1000], [1200, 1000]))
  assert.deepEqual(
    alerts.map((a) => [a.category, a.level]),
    [
      ['incidental', 'over'],
      ['essential', 'near'],
    ],
  )
  assert.equal(alerts[0].used, 1.2)
})

test('exactly 100% is "near", not over; just past it is over', () => {
  assert.equal(budgetAlerts(groups([1000, 1000], [0, 0], [0, 0]))[0].level, 'near')
  assert.equal(budgetAlerts(groups([1001, 1000], [0, 0], [0, 0]))[0].level, 'over')
})

test('a group with no plan never warns, even with spending', () => {
  assert.deepEqual(budgetAlerts(groups([5000, 0], [0, 0], [0, 0])), [])
})

test('crossing a threshold warns once; staying inside it does not', () => {
  assert.equal(crossedThreshold(700, 820, 1000), 'near')
  assert.equal(crossedThreshold(820, 900, 1000), null)
  assert.equal(crossedThreshold(900, 1100, 1000), 'over')
  assert.equal(crossedThreshold(700, 1100, 1000), 'over')
  assert.equal(crossedThreshold(1100, 1200, 1000), null)
  assert.equal(crossedThreshold(100, 200, 1000), null)
  assert.equal(crossedThreshold(0, 500, 0), null)
})

test('the signature ignores order and amounts', () => {
  const a = budgetAlerts(groups([850, 1000], [0, 0], [1200, 1000]))
  const b = budgetAlerts(groups([990, 1000], [0, 0], [1500, 1000]))
  assert.equal(alertsSignature(a), alertsSignature(b))
  assert.equal(alertsSignature(a), 'essential:near,incidental:over')
})
