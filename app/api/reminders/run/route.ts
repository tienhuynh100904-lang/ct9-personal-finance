import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { appClockAt } from '@/lib/dates'
import { isPushConfigured, sendPush } from '@/lib/push'
import {
  isDueNow,
  normalizeRemindAt,
  pickReminderIndex,
  REMINDER_MESSAGES,
  REMINDER_TITLE,
  REMINDER_URL,
} from '@/lib/reminders'
import { createAdminClient } from '@/lib/supabase/admin'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Called every 15 minutes by pg_cron (Supabase) with `Authorization: Bearer <CRON_SECRET>`.
 * Sends today's reminder to each user whose time has come, unless they already logged something
 * today. Safe to call repeatedly: a user is claimed for the day before anything is sent.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isPushConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'push not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { iso: today, minutes } = appClockAt(new Date())
  const summary = { checked: 0, sent: 0, skippedLogged: 0, skippedNoDevice: 0, failed: 0 }

  const { data: settings, error } = await admin
    .from('reminder_settings')
    .select('user_id, remind_at, last_sent_on, last_message')
    .eq('enabled', true)
  if (error) {
    console.error('reminders: reading settings failed', error)
    return NextResponse.json({ error: 'settings' }, { status: 500 })
  }

  for (const setting of settings) {
    const due = isDueNow({
      remindAt: normalizeRemindAt(setting.remind_at),
      lastSentOn: setting.last_sent_on,
      today,
      nowMinutes: minutes,
    })
    if (!due) continue
    summary.checked += 1
    const userId = setting.user_id

    // Claim today for this user first, so two overlapping runs cannot both send.
    const claim = await admin
      .from('reminder_settings')
      .update({ last_sent_on: today })
      .eq('user_id', userId)
      .or(`last_sent_on.is.null,last_sent_on.neq.${today}`)
      .select('user_id')
    if (claim.error || claim.data.length === 0) continue

    const release = () =>
      admin.from('reminder_settings').update({ last_sent_on: setting.last_sent_on }).eq('user_id', userId)

    const [transactions, marks, subscriptions] = await Promise.all([
      admin.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('occurred_on', today),
      admin.from('day_marks').select('day', { count: 'exact', head: true }).eq('user_id', userId).eq('day', today),
      admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId),
    ])
    if (transactions.error || subscriptions.error) {
      console.error('reminders: lookup failed', transactions.error ?? subscriptions.error)
      summary.failed += 1
      await release()
      continue
    }

    // Already wrote something (or marked a no-spend day) today: nothing to remind about.
    if ((transactions.count ?? 0) > 0 || (marks.count ?? 0) > 0) {
      summary.skippedLogged += 1
      continue
    }
    if (subscriptions.data.length === 0) {
      summary.skippedNoDevice += 1
      await release()
      continue
    }

    const index = pickReminderIndex(setting.last_message)
    const result = await sendPush(subscriptions.data, {
      title: REMINDER_TITLE,
      body: REMINDER_MESSAGES[index],
      url: REMINDER_URL,
    })
    if (result.gone.length > 0) await admin.from('push_subscriptions').delete().in('id', result.gone)

    if (result.sent > 0) {
      summary.sent += 1
      await admin.from('reminder_settings').update({ last_message: index }).eq('user_id', userId)
    } else {
      summary.failed += 1
      await release() // try again on the next 15-minute run, within the send window
    }
  }

  return NextResponse.json(summary)
}
