import type { BudgetCategory, Category, Kind } from './finance'

export type CategoryMeta = {
  label: string
  kind: Kind
  /** CSS custom property holding the category's chart color. */
  color: string
  hint: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  main: {
    label: 'Thu nhập chính',
    kind: 'income',
    color: 'var(--c-income)',
    hint: 'Lương, thu nhập cố định hằng tháng',
  },
  side: {
    label: 'Thu nhập phụ',
    kind: 'income',
    color: 'var(--c-income)',
    hint: 'Làm thêm, bán hàng, freelance…',
  },
  irregular: {
    label: 'Thu nhập bất thường',
    kind: 'income',
    color: 'var(--c-income)',
    hint: 'Thưởng, quà, khoản thu không định kỳ',
  },
  essential: {
    label: 'Thiết yếu',
    kind: 'expense',
    color: 'var(--c-essential)',
    hint: 'Ăn uống, đi lại, nhà ở, hóa đơn…',
  },
  non_essential: {
    label: 'Không thiết yếu',
    kind: 'expense',
    color: 'var(--c-non-essential)',
    hint: 'Giải trí, mua sắm, cà phê…',
  },
  incidental: {
    label: 'Phát sinh',
    kind: 'expense',
    color: 'var(--c-incidental)',
    hint: 'Khoản chi ngoài dự tính',
  },
  saving: {
    label: 'Tiết kiệm/Đầu tư',
    kind: 'expense',
    color: 'var(--c-saving)',
    hint: 'Gửi tiết kiệm, đầu tư, quỹ dự phòng',
  },
}

export const KIND_LABEL: Record<Kind, string> = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
}

export function categoryLabel(category: BudgetCategory | Category): string {
  return CATEGORY_META[category].label
}

/** Colors of the headline measures — validated as one categorical set. */
export const MEASURE_COLOR = {
  income: 'var(--c-income)',
  spending: 'var(--c-expense)',
  saving: 'var(--c-saving)',
  surplus: 'var(--c-surplus)',
  planned: 'var(--c-planned)',
} as const
