import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appClockAt } from '../lib/dates.ts'
import {
  isDueNow,
  isValidRemindAt,
  normalizeRemindAt,
  pickReminderIndex,
  REMINDER_MESSAGES,
  SEND_WINDOW_MINUTES,
} from '../lib/reminders.ts'

test('there are ten distinct, short messages', () => {
  assert.equal(REMINDER_MESSAGES.length, 10)
  assert.equal(new Set(REMINDER_MESSAGES).size, 10)
  for (const message of REMINDER_MESSAGES) assert.ok(message.length > 0 && message.length <= 100, message)
})

test('the picked message is never yesterday\'s, whatever the random number', () => {
  for (let last = 0; last < REMINDER_MESSAGES.length; last++) {
    for (const r of [0, 0.1, 0.5, 0.9, 0.999999]) {
      const index = pickReminderIndex(last, () => r)
      assert.notEqual(index, last)
      assert.ok(index >= 0 && index < REMINDER_MESSAGES.length)
    }
  }
})

test('every message can be picked; with no history any message can be', () => {
  const seen = new Set<number>()
  for (let i = 0; i < 100; i++) seen.add(pickReminderIndex(null, () => i / 100))
  assert.equal(seen.size, 10)
})

test('reminder times are HH:MM in 15 minute steps', () => {
  for (const ok of ['00:00', '07:15', '21:00', '23:45']) assert.ok(isValidRemindAt(ok), ok)
  for (const bad of ['7:00', '24:00', '21:10', '21:00:00', '', null, 2100]) assert.ok(!isValidRemindAt(bad), String(bad))
  assert.equal(normalizeRemindAt('21:30:00'), '21:30')
  assert.equal(normalizeRemindAt('nonsense'), '21:00')
  assert.equal(normalizeRemindAt(null), '21:00')
})

test('due from the chosen time until the window ends, once per day', () => {
  const base = { remindAt: '21:00', lastSentOn: '2026-10-12', today: '2026-10-13' }
  const at = (h: number, m = 0) => h * 60 + m
  assert.equal(isDueNow({ ...base, nowMinutes: at(20, 45) }), false)
  assert.equal(isDueNow({ ...base, nowMinutes: at(21) }), true)
  assert.equal(isDueNow({ ...base, nowMinutes: at(21, 15) }), true)
  assert.equal(isDueNow({ ...base, nowMinutes: at(21) + SEND_WINDOW_MINUTES - 1 }), true)
  assert.equal(isDueNow({ ...base, nowMinutes: at(21) + SEND_WINDOW_MINUTES }), false)
  assert.equal(isDueNow({ ...base, lastSentOn: '2026-10-13', nowMinutes: at(21, 15) }), false)
  assert.equal(isDueNow({ ...base, lastSentOn: null, nowMinutes: at(21, 15) }), true)
})

test('a late reminder time never spills past midnight', () => {
  const base = { remindAt: '23:30', lastSentOn: null, today: '2026-10-13' }
  assert.equal(isDueNow({ ...base, nowMinutes: 23 * 60 + 45 }), true)
  assert.equal(isDueNow({ ...base, nowMinutes: 30 }), false)
})

test('the clock is Vietnam time (UTC+7), including across midnight', () => {
  assert.deepEqual(appClockAt(new Date('2026-10-13T14:00:00Z')), { iso: '2026-10-13', minutes: 21 * 60 })
  assert.deepEqual(appClockAt(new Date('2026-10-13T16:59:00Z')), { iso: '2026-10-13', minutes: 23 * 60 + 59 })
  assert.deepEqual(appClockAt(new Date('2026-10-13T17:30:00Z')), { iso: '2026-10-14', minutes: 30 })
})
