'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { isPushConfigured, sendPush } from '../push'
import { isValidRemindAt, pickReminderIndex, REMINDER_MESSAGES, REMINDER_TITLE, REMINDER_URL } from '../reminders'
import { isMissingTable } from '../supabase/errors'
import type { ActionResult } from './result'

const MISSING_TABLE_MESSAGE = 'Chưa bật tính năng nhắc ghi chép. Hãy chạy lại supabase/schema.sql.'
const NOT_CONFIGURED_MESSAGE = 'Chưa cấu hình khoá thông báo trên máy chủ (xem docs/nhac-ghi-chep.md).'

/** Saves the on/off switch and the reminder time (a multiple of 15 minutes, "HH:MM"). */
export async function saveReminderSettings(input: { enabled: boolean; remindAt: string }): Promise<ActionResult> {
  const { supabase, user } = await getSession()
  if (typeof input?.enabled !== 'boolean') return { ok: false, error: 'Cài đặt không hợp lệ.' }
  if (!isValidRemindAt(input.remindAt)) return { ok: false, error: 'Giờ nhắc không hợp lệ.' }

  const { error } = await supabase
    .from('reminder_settings')
    .upsert({ user_id: user.id, enabled: input.enabled, remind_at: input.remindAt }, { onConflict: 'user_id' })
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
    console.error('saveReminderSettings failed', error)
    return { ok: false, error: 'Không lưu được cài đặt nhắc. Vui lòng thử lại.' }
  }
  refresh()
  return { ok: true }
}

/** Remembers this device (browser push subscription) as a place to send reminders. */
export async function savePushSubscription(input: {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string
}): Promise<ActionResult> {
  const { supabase, user } = await getSession()
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : ''
  const p256dh = typeof input?.keys?.p256dh === 'string' ? input.keys.p256dh : ''
  const auth = typeof input?.keys?.auth === 'string' ? input.keys.auth : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 2048 || !p256dh || !auth) {
    return { ok: false, error: 'Thiết bị không hợp lệ.' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof input.userAgent === 'string' ? input.userAgent.slice(0, 300) : null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
    console.error('savePushSubscription failed', error)
    return { ok: false, error: 'Không đăng ký được thiết bị. Vui lòng thử lại.' }
  }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (typeof endpoint !== 'string' || !endpoint) return { ok: false, error: 'Thiết bị không hợp lệ.' }
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) {
    console.error('removePushSubscription failed', error)
    return { ok: false, error: 'Không gỡ được thiết bị. Vui lòng thử lại.' }
  }
  return { ok: true }
}

/** Sends one reminder right now to every registered device ("Gửi thử"). Does not count as today's reminder. */
export async function sendTestReminder(): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isPushConfigured()) return { ok: false, error: NOT_CONFIGURED_MESSAGE }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
    console.error('sendTestReminder read failed', error)
    return { ok: false, error: 'Không đọc được danh sách thiết bị.' }
  }
  if (subscriptions.length === 0) return { ok: false, error: 'Chưa có thiết bị nào đăng ký nhận thông báo.' }

  const result = await sendPush(subscriptions, {
    title: REMINDER_TITLE,
    body: REMINDER_MESSAGES[pickReminderIndex(null)],
    url: REMINDER_URL,
  })
  if (result.gone.length > 0) await supabase.from('push_subscriptions').delete().in('id', result.gone)

  if (result.sent === 0) {
    return { ok: false, error: 'Không gửi được thông báo. Hãy tắt rồi bật lại nhắc trên thiết bị này.' }
  }
  return { ok: true, message: 'Đã gửi thông báo thử.' }
}
