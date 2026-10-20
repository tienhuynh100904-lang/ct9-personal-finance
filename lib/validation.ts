import { isUuid } from './actions/result'
import { isValidISODate } from './dates'
import { BUDGET_CATEGORIES, isCategoryOf, type BudgetCategory, type Category, type Kind } from './finance'
import { MAX_GOAL_RATE_BP, type GoalKind, type GoalPlace } from './goals'
import { cleanItemName } from './items'
import { MAX_REMIND_DAYS } from './recurring'

export const MAX_AMOUNT = 999_999_999_999
export const MAX_ITEM_LENGTH = 100
export const MAX_NOTE_LENGTH = 500

/** `item_id`: every transaction belongs to one item of the user's "Danh mục khoản mục". */
export type TransactionInput = {
  id?: string
  kind: Kind
  item_id: string
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

type TransactionBody = { kind: Kind; category: Category; amount: number; occurred_on: string; note: string | null }

/** What a transaction has besides its item: kind, category, amount, day and note. Records problems in `errors`. */
function checkTransactionBody(raw: Record<string, unknown>, errors: Record<string, string>): TransactionBody {
  const kind = raw.kind
  if (!isKind(kind)) errors.kind = 'Chọn loại giao dịch.'

  const category = typeof raw.category === 'string' ? raw.category : ''
  if (isKind(kind) && !isCategoryOf(kind, category)) errors.category = 'Chọn phân loại.'

  if (!isAmount(raw.amount)) errors.amount = 'Nhập số tiền lớn hơn 0.'

  const date = typeof raw.occurred_on === 'string' ? raw.occurred_on : ''
  if (!isValidISODate(date) || date < '2000-01-01' || date > '2100-12-31') errors.occurred_on = 'Ngày không hợp lệ.'

  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) errors.note = `Tối đa ${MAX_NOTE_LENGTH} ký tự.`

  return { kind: kind as Kind, category: category as Category, amount: raw.amount as number, occurred_on: date, note: note || null }
}

/** Runs on the client for instant feedback and again on the server, where it is authoritative. */
export function validateTransaction(input: unknown): Validated<TransactionValues, FieldErrors<TransactionInput>> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<TransactionInput> = {}

  const body = checkTransactionBody(raw, errors)
  if (!isUuid(raw.item_id)) errors.item_id = 'Chọn khoản mục.'

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return { ok: true, value: { kind: body.kind, item_id: raw.item_id as string, category: body.category, amount: body.amount, occurred_on: body.occurred_on, note: body.note } }
}

/** A transaction as a CSV row describes it: the item is a name, found or created when the file is imported. */
export type ImportRowInput = Omit<TransactionInput, 'id' | 'item_id'> & { item: string }
export type ImportRowValues = Omit<ImportRowInput, 'note'> & { note: string | null }

export function validateImportRow(input: unknown): Validated<ImportRowValues, FieldErrors<ImportRowInput>> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<ImportRowInput> = {}

  const body = checkTransactionBody(raw, errors)
  const item = typeof raw.item === 'string' ? cleanItemName(raw.item) : ''
  if (!item) errors.item = 'Nhập tên khoản mục.'
  else if (item.length > MAX_ITEM_LENGTH) errors.item = `Tối đa ${MAX_ITEM_LENGTH} ký tự.`

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return { ok: true, value: { kind: body.kind, item, category: body.category, amount: body.amount, occurred_on: body.occurred_on, note: body.note } }
}

export type RecurringInput = {
  id?: string
  kind: Kind
  item_id: string
  category: Category
  amount: number
  /** 1–31; past the end of a short month it falls on the last day. */
  day_of_month: number
  /** 0–7: days before and after the due date in which the dashboard shows the entry. */
  remind_days: number
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

  const remind = raw.remind_days
  if (typeof remind !== 'number' || !Number.isInteger(remind) || remind < 0 || remind > MAX_REMIND_DAYS) {
    errors.remind_days = `Chọn số ngày từ 0 đến ${MAX_REMIND_DAYS}.`
  }

  if (!base.ok || Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  const { kind, item_id, category, amount, note } = base.value
  return { ok: true, value: { kind, item_id, category, amount, note, day_of_month: day as number, remind_days: remind as number } }
}

export type ItemInput = { kind: Kind; name: string; default_category: Category | null }

export function validateItem(input: unknown): Validated<ItemInput> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<ItemInput> = {}
  const kind = raw.kind
  if (!isKind(kind)) errors.kind = 'Chọn loại khoản mục.'
  const name = typeof raw.name === 'string' ? cleanItemName(raw.name) : ''
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

export const MAX_GOAL_NAME_LENGTH = 60
export const MAX_GOAL_NOTE_LENGTH = 1000

export type GoalInput = {
  id?: string
  kind: GoalKind
  name: string
  /** Custom goals only; the emergency fund's target is monthly_expense × reserve_months. */
  target_amount?: number
  monthly_expense?: number | null
  reserve_months?: number | null
  start_date: string
  months: number
  /** Basis points: 400 = 4%/năm, at most MAX_GOAL_RATE_BP. */
  rate_bp: number
  place: GoalPlace
  initial_amount: number
  note?: string | null
}

export type GoalValues = {
  kind: GoalKind
  name: string
  target_amount: number
  monthly_expense: number | null
  reserve_months: number | null
  start_date: string
  months: number
  rate_bp: number
  place: GoalPlace
  initial_amount: number
  note: string | null
}

function isWholeAmount(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= MAX_AMOUNT
}

/** Runs on the client for instant feedback and again on the server, where it is authoritative. */
export function validateGoal(input: unknown): Validated<GoalValues, FieldErrors<GoalInput>> {
  const raw = (input ?? {}) as Record<string, unknown>
  const errors: FieldErrors<GoalInput> = {}
  const kind: GoalKind = raw.kind === 'emergency' ? 'emergency' : 'custom'

  const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : ''
  if (!name) errors.name = 'Nhập tên quỹ.'
  else if (name.length > MAX_GOAL_NAME_LENGTH) errors.name = `Tối đa ${MAX_GOAL_NAME_LENGTH} ký tự.`

  let target = 0
  let monthlyExpense: number | null = null
  let reserveMonths: number | null = null
  if (kind === 'emergency') {
    if (!isWholeAmount(raw.monthly_expense, 1)) errors.monthly_expense = 'Nhập chi phí cố định 1 tháng.'
    else monthlyExpense = raw.monthly_expense
    const months = raw.reserve_months
    if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 24) errors.reserve_months = 'Chọn từ 1 đến 24 tháng.'
    else reserveMonths = months
    if (monthlyExpense !== null && reserveMonths !== null) {
      target = monthlyExpense * reserveMonths
      if (target > MAX_AMOUNT) errors.monthly_expense = 'Số tiền quá lớn.'
    }
  } else if (!isWholeAmount(raw.target_amount, 1)) {
    errors.target_amount = 'Nhập số tiền mục tiêu lớn hơn 0.'
  } else {
    target = raw.target_amount
  }

  const start = typeof raw.start_date === 'string' ? raw.start_date : ''
  if (!isValidISODate(start) || start < '2000-01-01' || start > '2100-12-31') errors.start_date = 'Ngày không hợp lệ.'

  const months = raw.months
  if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 600) errors.months = 'Từ 1 đến 600 tháng.'

  const rate = raw.rate_bp
  if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 0 || rate > MAX_GOAL_RATE_BP) {
    errors.rate_bp = `Lợi nhuận kỳ vọng từ 0 đến ${MAX_GOAL_RATE_BP / 100}%/năm. Cao hơn là không thực tế.`
  }

  const place = raw.place
  if (place !== 'bank' && place !== 'app' && place !== 'mmf') errors.place = 'Chọn nơi cất quỹ.'

  const initial = raw.initial_amount ?? 0
  if (!isWholeAmount(initial, 0)) errors.initial_amount = 'Số tiền không hợp lệ.'

  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note.length > MAX_GOAL_NOTE_LENGTH) errors.note = `Tối đa ${MAX_GOAL_NOTE_LENGTH} ký tự.`

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    value: {
      kind,
      name,
      target_amount: target,
      monthly_expense: monthlyExpense,
      reserve_months: reserveMonths,
      start_date: start,
      months: months as number,
      rate_bp: rate as number,
      place: place as GoalPlace,
      initial_amount: initial as number,
      note: note || null,
    },
  }
}
