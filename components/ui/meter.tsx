import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { budgetStatus, type BudgetStatus } from '@/lib/finance'
import { formatPercent, formatVND } from '@/lib/format'

const STATUS: Record<BudgetStatus, { fill?: string; text: string; Icon: typeof CircleCheck }> = {
  ok: { text: 'text-muted', Icon: CircleCheck },
  near: { fill: 'var(--s-warning)', text: 'text-warning', Icon: TriangleAlert },
  over: { fill: 'var(--s-critical)', text: 'text-negative', Icon: CircleAlert },
  unplanned: { fill: 'var(--s-warning)', text: 'text-warning', Icon: TriangleAlert },
}

/**
 * Budget usage bar. The fill is the category color while on track and turns
 * into a status color near/over the limit — always with an icon and a label.
 */
export function BudgetMeter({
  label,
  color,
  actual,
  planned,
}: {
  label: string
  color: string
  actual: number
  planned: number
}) {
  const { used, status } = budgetStatus(actual, planned)
  const { fill = color, text, Icon } = STATUS[status]
  const width = planned > 0 ? Math.min(used, 1) * 100 : actual > 0 ? 100 : 0
  const remaining = planned - actual

  const caption =
    status === 'unplanned'
      ? 'Chưa đặt ngân sách'
      : status === 'over'
        ? `Vượt ${formatVND(-remaining)}`
        : planned > 0
          ? `Còn ${formatVND(remaining)}`
          : 'Chưa đặt ngân sách'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tabular-nums text-ink-2">
          {formatVND(actual)}
          <span className="text-muted"> / {planned > 0 ? formatVND(planned) : '—'}</span>
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={`${label}: đã dùng ${planned > 0 ? formatPercent(used, 0) : 'không có ngân sách'}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, background: fill }} />
      </div>
      <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${text}`}>
        <Icon className="size-3.5" aria-hidden />
        {caption}
        {planned > 0 ? <span className="text-muted">· đã dùng {formatPercent(used, 0)}</span> : null}
      </p>
    </div>
  )
}
