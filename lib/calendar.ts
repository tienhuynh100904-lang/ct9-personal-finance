/**
 * Calendar maths for the date picker. Pure functions on `YYYY-MM-DD` calendar dates (no time
 * zone: everything is computed in UTC so the result is the same wherever the code runs).
 */

/** Weeks start on Monday, as in Vietnam. */
export const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

export const MIN_DATE = '2000-01-01'
export const MAX_DATE = '2100-12-31'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Moves a date by whole months; the day is clamped (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parseISO(iso)
  const index = year * 12 + (month - 1) + months
  const nextYear = Math.floor(index / 12)
  const nextMonth = (index % 12) + 1
  return toISO(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)))
}

/** The days of one month laid out in weeks starting Monday; `null` pads the first and last week. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= daysInMonth(year, month); day++) cells.push(toISO(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const WEEKDAY_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const

/** "Thứ hai, 12/10/2026". */
export function longDateLabel(iso: string): string {
  const { year, month, day } = parseISO(iso)
  return `${WEEKDAY_LONG[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${pad(day)}/${pad(month)}/${year}`
}
