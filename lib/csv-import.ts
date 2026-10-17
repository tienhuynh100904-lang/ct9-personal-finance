/**
 * Reads a CSV of transactions back in, in the format `buildTransactionsCsv` exports: five columns
 * "Tên khoản mục, Ngày nhận | Ngày chi, Phân loại, Số tiền, Ghi chú", one kind per file (the date
 * header says which: "Ngày nhận" is income, "Ngày chi" is expense).
 *
 * It is forgiving where a person may have edited the file in Excel or Google Sheets: `,` `;` or tab
 * separators, a BOM, CRLF or LF, dates as 2026-10-13 / 13/10/2026 / an Excel serial number, amounts
 * as 45000 / 45.000 / 45,000 / "45.000 ₫", and categories by their Vietnamese name (accents and case
 * ignored) or by code. Whatever cannot be understood is reported per row, never guessed.
 *
 * Pure (no DOM, no server APIs) so it runs in the browser, on the server and under `node --test`.
 * Field-level limits (length, maximum amount) are left to `validateTransaction`.
 */
import { CATEGORY_META } from './categories.ts'
import type { Category, Kind } from './finance'

/** One data row, with whatever could be read from it. */
export type ImportCandidate = {
  /** 1-based record number in the file, counting the header (so a header-less file starts at 1). */
  line: number
  item: string
  /** `YYYY-MM-DD`, or `null` when the date could not be read. */
  occurred_on: string | null
  category: Category | null
  amount: number | null
  note: string
  /** What could not be read, in Vietnamese, ready to show. Empty when the row is understood. */
  problems: string[]
}

export type ParsedCsv = {
  /** From the date header; `null` when the file has no recognisable header. */
  kind: Kind | null
  hasHeader: boolean
  rows: ImportCandidate[]
  /** Blank records that were skipped. */
  skippedBlank: number
}

export const MAX_IMPORT_ROWS = 1500

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// ---- CSV text → records -----------------------------------------------------------------

function detectDelimiter(text: string): string {
  // Count candidates on the first record only, outside quotes.
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && ch in counts) counts[ch] += 1
  }
  return counts[';'] > counts[','] && counts[';'] >= counts['\t'] ? ';' : counts['\t'] > counts[','] ? '\t' : ','
}

/** RFC 4180 records: quoted cells may hold separators, line breaks and doubled quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === delimiter) {
      record.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      record.push(cell)
      records.push(record)
      record = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell)
    records.push(record)
  }
  return records
}

// ---- Cells → values ---------------------------------------------------------------------

/** The export prefixes a `'` to text Excel would run as a formula; take it off again. */
function plain(cell: string): string {
  const text = cell.trim()
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `2026-10-13`, `13/10/2026`, `13-10-2026`, `13.10.2026`, `2026/10/13` or an Excel serial number. */
export function parseDateText(raw: string): string | null {
  const text = raw.trim()
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(text)
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/.exec(text)
  if (m) return isRealDate(+m[3], +m[2], +m[1]) ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null
  // Excel stores dates as days since 1899-12-30; a cell formatted as General shows that number.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86_400_000)
    return isRealDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
      ? `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
      : null
  }
  return null
}

/** Whole đồng: `45000`, `45.000`, `45,000`, `45000.00`, `45.000 ₫`, `45000đ`. Never negative or fractional. */
export function parseAmountText(raw: string): number | null {
  const text = raw.replace(/\s|₫|đ|vnd|vnđ/gi, '')
  if (/^\d+$/.test(text)) return Number(text)
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ''))
  if (/^\d+[.,]0+$/.test(text)) return Number(text.replace(/[.,].*$/, ''))
  return null
}

const CATEGORY_LOOKUP = new Map<string, Category>(
  (Object.keys(CATEGORY_META) as Category[]).flatMap((code) => [
    [fold(CATEGORY_META[code].label), code] as const,
    [code, code] as const,
  ]),
)

/** "Thiết yếu", "thiet yeu" and "essential" all give `essential`. */
export function parseCategoryText(raw: string): Category | null {
  return CATEGORY_LOOKUP.get(fold(raw)) ?? null
}

// ---- Records → candidates ---------------------------------------------------------------

type Columns = { item: number; date: number; category: number; amount: number; note: number }

const FIXED_COLUMNS: Columns = { item: 0, date: 1, category: 2, amount: 3, note: 4 }

/** Finds the columns by header name, so reordered or extra columns still import. */
function readHeader(cells: string[]): { columns: Columns; kind: Kind | null } | null {
  const names = cells.map(fold)
  const find = (test: (name: string) => boolean) => names.findIndex(test)
  const columns: Columns = {
    item: find((n) => n.startsWith('ten khoan muc') || n === 'khoan muc' || n === 'noi dung'),
    date: find((n) => n.startsWith('ngay')),
    category: find((n) => n === 'phan loai'),
    amount: find((n) => n === 'so tien'),
    note: find((n) => n === 'ghi chu'),
  }
  if (columns.item < 0 || columns.date < 0 || columns.amount < 0 || columns.category < 0) return null
  const dateName = names[columns.date]
  return { columns, kind: dateName.includes('nhan') ? 'income' : dateName.includes('chi') ? 'expense' : null }
}

export function parseTransactionsCsv(text: string): ParsedCsv {
  const records = parseCsv(text)
  const header = records.length > 0 ? readHeader(records[0]) : null
  const columns = header?.columns ?? FIXED_COLUMNS
  const first = header ? 1 : 0

  const rows: ImportCandidate[] = []
  let skippedBlank = 0
  for (let i = first; i < records.length; i++) {
    const cells = records[i]
    if (cells.every((c) => c.trim() === '')) {
      skippedBlank += 1
      continue
    }
    const at = (index: number) => (index >= 0 ? plain(cells[index] ?? '') : '')
    const item = at(columns.item).replace(/\s+/g, ' ')
    const dateText = at(columns.date)
    const categoryText = at(columns.category)
    const amountText = at(columns.amount)

    const problems: string[] = []
    const occurred_on = parseDateText(dateText)
    const category = parseCategoryText(categoryText)
    const amount = parseAmountText(amountText)
    if (!item) problems.push('Thiếu tên khoản mục.')
    if (!dateText) problems.push('Thiếu ngày.')
    else if (!occurred_on) problems.push(`Ngày “${dateText}” không hợp lệ (dùng dạng 2026-10-13 hoặc 13/10/2026).`)
    if (!categoryText) problems.push('Thiếu phân loại.')
    else if (!category) problems.push(`Phân loại “${categoryText}” không có trong app.`)
    if (!amountText) problems.push('Thiếu số tiền.')
    else if (amount === null || amount <= 0) problems.push(`Số tiền “${amountText}” không hợp lệ (cần số nguyên dương, đơn vị đồng).`)

    rows.push({ line: i + 1, item, occurred_on, category, amount: amount && amount > 0 ? amount : null, note: at(columns.note), problems })
  }
  return { kind: header?.kind ?? null, hasHeader: header !== null, rows, skippedBlank }
}
