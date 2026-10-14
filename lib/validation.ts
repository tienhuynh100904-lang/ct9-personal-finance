import { isValidISODate } from './dates'
import { BUDGET_CATEGORIES, isCategoryOf, type BudgetCategory, type Category, type Kind } from './finance'

export const MAX_AMOUNT = 999_999_999_999
export const MAX_ITEM_LENGTH = 100
export const MAX_NOTE_LENGTH = 500

export type TransactionInput = {
  id?: string
  kind: Kind
  item: string
  category: Category
  amount: number
  occurred_on: string
  note?: string | null
}

export type TransactionValues = Omit<TransactionInput, 'id' | 'note'> & { note: string | null }

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export type Validated<T, E = FieldErrors<T>> = { ok: true; value: T } | { ok: false; fieldErrors: E }

function isKind(value: unknown): value is Kind {
  return value === 'income' || value === 'expense'
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT
}

/** Runs on the client for instant feedback and again on the server, where it is authoritative. */
export function validateTransaction(input: unknown): Validated<TransactionValues, FieldErrors<TransactionInput>> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<TransactionInput> = {}

  const kind = raw.kind
  if (!isKind(kind)) errors.kind = 'Chọn loại giao dịch.'

  const item = typeof raw.item === 'string' ? raw.item.trim().replace(/\s+/g, ' ') : ''
  if (!item) errors.item = 'Nhập tên khoản mục.'
  else if (item.length > MAX_ITEM_LENGTH) errors.item = `Tối đa ${MAX_ITEM_LENGTH} ký tự.`

  const category = typeof raw.category === 'string' ? raw.category : ''
  if (isKind(kind) && !isCategoryOf(kind, category)) errors.category = 'Chọn phân loại.'

  if (!isAmount(raw.amount)) errors.amount = 'Nhập số tiền lớn hơn 0.'

  const date = typeof raw.occurred_on === 'string' ? raw.occurred_on : ''
  if (!isValidISODate(date) || date < '2000-01-01' || date > '2100-12-31') errors.occurred_on = 'Ngày không hợp lệ.'

  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) errors.note = `Tối đa ${MAX_NOTE_LENGTH} ký tự.`

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    value: {
      kind: kind as Kind,
      item,
      category: category as Category,
      amount: raw.amount as number,
      occurred_on: date,
      note: note || null,
    },
  }
}

export type RecurringInput = {
  id?: string
  kind: Kind
  item: string
  category: Category
  amount: number
  /** 1–31; past the end of a short month it falls on the last day. */
  day_of_month: number
  note?: string | null
}

export type RecurringValues = Omit<RecurringInput, 'id' | 'note'> & { note: string | null }

/** Same rules as a transaction, with a day of the month instead of a date. */
export function validateRecurring(input: unknown): Validated<RecurringValues, FieldErrors<RecurringInput>> {
  const raw = (input ?? {}) as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10)
  const base = validateTransaction({ ...raw, occurred_on: today })
  const errors: FieldErrors<RecurringInput> = base.ok ? {} : { ...base.fieldErrors }
  delete (errors as FieldErrors<TransactionInput>).occurred_on

  const day = raw.day_of_month
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 31) errors.day_of_month = 'Chọn ngày trong tháng (1–31).'

  if (!base.ok || Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  const { kind, item, category, amount, note } = base.value
  return { ok: true, value: { kind, item, category, amount, note, day_of_month: day as number } }
}

export type ItemInput = { kind: Kind; name: string; default_category: Category | null }

export function validateItem(input: unknown): Validated<ItemInput> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<ItemInput> = {}
  const kind = raw.kind
  if (!isKind(kind)) errors.kind = 'Chọn loại khoản mục.'
  const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : ''
  if (!name) errors.name = 'Nhập tên khoản mục.'
  else if (name.length > MAX_ITEM_LENGTH) errors.name = `Tối đa ${MAX_ITEM_LENGTH} ký tự.`
  const category = raw.default_category
  if (category !== null && category !== undefined && category !== '') {
    if (!isKind(kind) || typeof category !== 'string' || !isCategoryOf(kind, category)) {
      errors.default_category = 'Phân loại không hợp lệ.'
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    value: { kind: kind as Kind, name, default_category: category ? (category as Category) : null },
  }
}

export type BudgetMonthInput = {
  year: number
  month: number
  values: Partial<Record<BudgetCategory, number>>
  applyToFollowingMonths: boolean
}

export function validateBudgetMonth(input: unknown): Validated<BudgetMonthInput, string> {
  const raw = (input ?? {}) as Record<string, unknown>
  const year = raw.year
  const month = raw.month
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, fieldErrors: 'Năm không hợp lệ.' }
  }
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, fieldErrors: 'Tháng không hợp lệ.' }
  }
  const rawValues = (raw.values ?? {}) as Record<string, unknown>
  const values: Partial<Record<BudgetCategory, number>> = {}
  for (const category of BUDGET_CATEGORIES) {
    const value = rawValues[category]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_AMOUNT) {
      return { ok: false, fieldErrors: 'Số tiền ngân sách không hợp lệ.' }
    }
    values[category] = value
  }
  return {
    ok: true,
    value: { year, month, values, applyToFollowingMonths: raw.applyToFollowingMonths === true },
  }
}
