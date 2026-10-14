import { CATEGORY_META } from './categories'
import type { BudgetAlert } from './finance'
import { formatPercent, formatVND } from './format'
import { toast } from './toast'

/** The warning shown right after an entry pushes its spending group past 80% or 100% of the plan. */
export function showBudgetAlert(alert: BudgetAlert, date: string) {
  const label = CATEGORY_META[alert.category].label
  const month = Number(date.slice(5, 7))
  if (alert.level === 'over') {
    toast.warning(`Vượt ngân sách ${label} tháng ${month}`, {
      description: `Đã chi ${formatVND(alert.actual)} / ${formatVND(alert.planned)} (${formatPercent(alert.used, 0)}), vượt ${formatVND(alert.actual - alert.planned)}.`,
    })
  } else {
    toast.warning(`${label} đã dùng ${formatPercent(alert.used, 0)} ngân sách tháng ${month}`, {
      description: `Còn ${formatVND(alert.planned - alert.actual)} cho nhóm này đến hết tháng.`,
    })
  }
}
