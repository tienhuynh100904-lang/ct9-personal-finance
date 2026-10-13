const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
const numberFormatter = new Intl.NumberFormat('vi-VN')
const decimalFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** "5.000.000 ₫" */
export function formatVND(value: number): string {
  return vndFormatter.format(Math.round(value))
}

/** "5.000.000" — no currency sign, for dense tables. */
export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value))
}

/** "+5.000.000 ₫" / "−130.000 ₫" — the sign carries meaning, not just the color. */
export function formatSignedVND(value: number): string {
  if (value === 0) return formatVND(0)
  return `${value > 0 ? '+' : '−'}${formatVND(Math.abs(value))}`
}

/** Short form used on chart axes and chips: "130k", "1,5tr", "1,2 tỷ". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1e9) return `${sign}${decimalFormatter.format(abs / 1e9)} tỷ`
  if (abs >= 1e6) return `${sign}${decimalFormatter.format(abs / 1e6)}tr`
  if (abs >= 1e3) return `${sign}${decimalFormatter.format(abs / 1e3)}k`
  return `${sign}${numberFormatter.format(abs)}`
}

/** "66,6%" — `null` (Excel's #DIV/0!) renders as an em dash. */
export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: digits }).format(value)
}

export const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`)
export const MONTH_SHORT = Array.from({ length: 12 }, (_, i) => `T${i + 1}`)

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const dayFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})
const weekdayFormatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' })

/** "06/10/2026" */
export function formatDate(iso: string): string {
  return dayFormatter.format(utcDate(iso))
}

/** "Thứ Ba" */
export function formatWeekday(iso: string): string {
  const weekday = weekdayFormatter.format(utcDate(iso))
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

/** Lower-case and accent-free, so "an uong" matches "Ăn uống". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** "13/10" */
export function formatDayMonth(iso: string): string {
  return `${iso.slice(8)}/${iso.slice(5, 7)}`
}

/** "Thứ Ba, 13/10" */
export function formatDayLabel(iso: string): string {
  return `${formatWeekday(iso)}, ${formatDayMonth(iso)}`
}

/** Keeps only digits: "1.250.000 ₫" → 1250000. Returns 0 for empty input. */
export function parseAmount(input: string): number {
  const digits = input.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}
