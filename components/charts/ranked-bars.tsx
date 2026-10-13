import type { ItemTotal } from '@/lib/finance'
import { formatPercent, formatVND } from '@/lib/format'

/**
 * Horizontal ranked bars in plain HTML: one series, one color, every bar
 * direct-labeled with its value and share — legible on any screen width.
 */
export function RankedBars({
  items,
  color,
  limit,
  emptyText = 'Chưa có khoản chi nào.',
}: {
  items: ItemTotal[]
  color: string
  limit?: number
  emptyText?: string
}) {
  const shown = limit ? items.slice(0, limit) : items
  const max = shown[0]?.total ?? 0

  if (shown.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>

  return (
    <ol className="space-y-3">
      {shown.map((item, index) => (
        <li key={item.item}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
              <span className="truncate font-medium">{item.item}</span>
              <span className="shrink-0 text-xs text-muted">{item.count} lần</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatVND(item.total)}
              <span className="ml-2 inline-block w-11 text-right text-xs text-muted">{formatPercent(item.share, 0)}</span>
            </span>
          </div>
          <div className="mt-1.5 ml-7 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${max > 0 ? Math.max((item.total / max) * 100, 1.5) : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
