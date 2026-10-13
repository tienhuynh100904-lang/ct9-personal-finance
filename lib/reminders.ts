/**
 * Daily "ghi chép" reminder: the ten messages, how one is picked, and when a reminder is due.
 * Pure functions with no imports, shared by the server (cron route, test button) and the settings
 * screen. Every date is a Vietnam-time `YYYY-MM-DD`, every time a `HH:MM` string.
 */

export const REMINDER_TITLE = 'CT9 Finance · Nhắc ghi chép'
/** Where tapping the notification goes: the add-transaction sheet. */
export const REMINDER_URL = '/?add=expense'

export const REMINDER_MESSAGES = [
  'Hôm nay bạn đã ghi chi tiêu chưa? Chỉ mất vài giây thôi.',
  'Một khoản nhỏ cũng đáng ghi lại. Mở app ghi nhanh nhé!',
  'Ly cà phê, bữa trưa, tiền xăng… hôm nay bạn đã ghi chưa?',
  'Ghi ngay khi còn nhớ, cuối tháng bạn sẽ cảm ơn chính mình.',
  'Chuỗi ngày ghi chép đang chờ bạn. Ghi một khoản để giữ lửa nhé!',
  'Hôm nay không chi gì? Bấm "Không chi tiêu" để giữ chuỗi.',
  'Hôm nay còn được chi bao nhiêu? Ghi lại để biết con số chính xác.',
  'Mỗi ngày một phút, tiền bạc rõ ràng cả tháng.',
  'Đừng để cuối tuần mới ngồi nhớ lại từng khoản. Ghi luôn bây giờ nhé!',
  'Thói quen nhỏ, kết quả lớn. Ghi thu chi hôm nay nào!',
] as const

/**
 * A random message index that is never `last` (yesterday's), so two days in a row never repeat.
 * `random` is injectable for tests.
 */
export function pickReminderIndex(last: number | null, random: () => number = Math.random): number {
  const candidates = REMINDER_MESSAGES.map((_, i) => i).filter((i) => i !== last)
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
}

export const DEFAULT_REMIND_AT = '21:00'
/** The cron job runs every 15 minutes, so reminder times are multiples of 15. */
export const REMIND_MINUTE_STEP = 15
/** A tick that was missed (cron hiccup) is still answered for this long, but not later. */
export const SEND_WINDOW_MINUTES = 180

const REMIND_AT_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/

export function isValidRemindAt(value: unknown): value is string {
  return typeof value === 'string' && REMIND_AT_PATTERN.test(value)
}

/** Postgres returns `time` as "21:00:00"; the app works with "21:00". */
export function normalizeRemindAt(value: string | null | undefined): string {
  const short = typeof value === 'string' ? value.slice(0, 5) : ''
  return isValidRemindAt(short) ? short : DEFAULT_REMIND_AT
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Is this the moment to send today's reminder? Yes from the chosen time until
 * `SEND_WINDOW_MINUTES` later (never past midnight), and only if one was not already sent today.
 */
export function isDueNow({
  remindAt,
  lastSentOn,
  today,
  nowMinutes,
}: {
  remindAt: string
  lastSentOn: string | null
  today: string
  nowMinutes: number
}): boolean {
  if (lastSentOn === today) return false
  const start = minutesOfDay(remindAt)
  return nowMinutes >= start && nowMinutes < Math.min(start + SEND_WINDOW_MINUTES, 24 * 60)
}
