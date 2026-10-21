import { cn } from '@/lib/cn'
import type { ItemTotal } from '@/lib/finance'
import { formatCompact, formatPercent, formatVND } from '@/lib/format'

/**
 * Vertical column chart of expense totals per item, in plain HTML. Every column is a toggle button
 * (pressing the selected one clears it) so the chart can drive a filter; the other columns fade while
 * one is selected. Columns keep a minimum width and the row scrolls sideways when there are many.
 */
export function ItemColumns({
  items,
  color,
  selected,
  onSelect,
  label,
}: {
  items: ItemTotal[]
  color: string
  selected: string | null
  onSelect: (item: string | null) => void
  label: string
}) {
  const max = items[0]?.total ?? 0

  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((entry) => {
        const isSelected = selected === entry.item
        return (
          <button
            key={entry.item}
            type="button"
            aria-pressed={isSelected}
            title={`${entry.item}: ${formatVND(entry.total)} · ${entry.count} lần · ${formatPercent(entry.share, 0)}`}
            onClick={() => onSelect(isSelected ? null : entry.item)}
            className={cn(
              'flex min-w-[4.75rem] flex-1 flex-col items-stretch rounded-xl px-1.5 pt-2 pb-2 text-center transition-[background-color,opacity] focus:outline-none focus-visible:ring-3 focus-visible:ring-focus/30',
              isSelected ? 'bg-brand-soft ring-1 ring-brand-edge' : 'hover:bg-surface-2 active:bg-surface-2',
              selected !== null && !isSelected && 'opacity-55 hover:opacity-100',
            )}
          >
            <span className="text-xs font-medium tabular-nums">{formatCompact(entry.total)}</span>
            <span className="mt-1 flex h-36 items-end justify-center border-b border-line">
              <span
                className="w-full max-w-11 rounded-t-lg"
                style={{ height: `${max > 0 ? Math.max((entry.total / max) * 100, 2) : 0}%`, background: color }}
              />
            </span>
            <span className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-4 font-medium break-words">{entry.item}</span>
            <span className="text-[11px] tabular-nums text-muted">{formatPercent(entry.share, 0)}</span>
          </button>
        )
      })}
    </div>
  )
}
