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

type ParamValue = string | string[] | undefined

function firstValue(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseYear(value: ParamValue): number | null {
  const year = Number(firstValue(value))
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null
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
