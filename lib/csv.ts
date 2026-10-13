import { CATEGORY_META } from './categories.ts'
import type { Kind } from './finance'
import type { TransactionRecord } from './types'

/**
 * The columns match the "Thu Chi" sheet of the original workbook (the income table and the
 * expense table have the same five columns), so an export can be pasted straight under the
 * header of the matching table.
 */
const DATE_HEADER: Record<Kind, string> = { income: 'Ngày nhận', expense: 'Ngày chi' }
const FILE_PREFIX: Record<Kind, string> = { income: 'thu-nhap', expense: 'chi-tieu' }

function cell(value: string | number) {
  let text = String(value)
  // Text that Excel would run as a formula is shown as plain text instead.
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV of one kind of transaction, oldest first. Dates are ISO (`2026-10-13`), which Excel reads
 * as a date in every regional setting, and amounts are plain numbers. The leading BOM keeps
 * Vietnamese letters intact. There is deliberately no `sep=,` line: other apps (Google Sheets,
 * Numbers, text editors) show it as data.
 */
export function buildTransactionsCsv(rows: TransactionRecord[], kind: Kind): string {
  const header = ['Tên khoản mục', DATE_HEADER[kind], 'Phân loại', 'Số tiền', 'Ghi chú']
  const body = rows
    .filter((t) => t.kind === kind)
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at))
    .map((t) => [t.item, t.occurred_on, CATEGORY_META[t.category].label, t.amount, t.note ?? ''])
  return `﻿${[header, ...body].map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`
}

export function csvFileName(kind: Kind, year: number, month: number | 'all') {
  return `${FILE_PREFIX[kind]}-${year}${month === 'all' ? '' : `-${String(month).padStart(2, '0')}`}.csv`
}
