/** Dates are interpreted in Vietnam time, wherever the code runs (Vercel runs in UTC). */
export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date as `YYYY-MM-DD` in Vietnam time. */
export function todayISO(): string {
  return isoFormatter.format(new Date())
}

const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Today's date and the hour of day (0-23), both in Vietnam time. */
export function nowInAppTimeZone(): { iso: string; hour: number } {
  const now = new Date()
  return { iso: isoFormatter.format(now), hour: Number(hourFormatter.format(now)) }
}

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** The date and the minute of the day (0-1439) at `at`, both in Vietnam time. */
export function appClockAt(at: Date): { iso: string; minutes: number } {
  const parts = clockFormatter.formatToParts(at)
  const part = (type: 'hour' | 'minute') => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { iso: isoFormatter.format(at), minutes: part('hour') * 60 + part('minute') }
}

type ParamValue = string | string[] | undefined

function firstValue(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** The years the app accepts (same span as the calendar's MIN_DATE / MAX_DATE). */
export const MIN_YEAR = 2000
export const MAX_YEAR = 2100

/** Every year the year pickers offer, newest first, so any period can be browsed or planned. */
export const YEAR_OPTIONS: number[] = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i)

export function parseYear(value: ParamValue): number | null {
  const year = Number(firstValue(value))
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR ? year : null
}

export function parseMonth(value: ParamValue): number | null {
  const month = Number(firstValue(value))
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
