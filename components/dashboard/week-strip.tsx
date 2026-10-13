'use client'

import { Check, Leaf } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDayLabel } from '@/lib/format'
import type { WeekCell } from '@/lib/habit'

function cellLabel(cell: WeekCell): string {
  const day = formatDayLabel(cell.iso)
  if (cell.state === 'logged') return `${day}: đã ghi ${cell.count} khoản${cell.isToday ? ' (hôm nay)' : ''}`
  if (cell.state === 'no_spend') return `${day}: không chi tiêu`
  if (cell.state === 'pending') return `${day}: hôm nay, chưa ghi`
  return `${day}: chưa có ghi chép`
}

/**
 * The last 7 days ending today. Tapping a day opens it, so a missed day is one tap
 * away from being filled in. State is never colour-only: icon, outline style and label.
 */
export function WeekStrip({
  cells,
  onSelect,
  celebrate,
  onCelebrateEnd,
}: {
  cells: WeekCell[]
  onSelect: (iso: string) => void
  /** Plays a one-off pop on today's cell the moment today first becomes logged. */
  celebrate: boolean
  onCelebrateEnd: () => void
}) {
  return (
    <ul aria-label="7 ngày gần đây" className="grid grid-cols-7 gap-0.5">
      {cells.map((cell) => (
        <li key={cell.iso}>
          <button
            type="button"
            onClick={() => onSelect(cell.iso)}
            aria-label={cellLabel(cell)}
            className="flex w-full flex-col items-center gap-1 rounded-xl py-1.5 transition-colors hover:bg-surface/60 active:bg-surface/60"
          >
            <span className={cn('text-[11px] leading-none', cell.isToday ? 'font-semibold text-ink' : 'text-muted')}>
              {cell.label}
            </span>
            <span
              onAnimationEnd={cell.isToday ? onCelebrateEnd : undefined}
              className={cn(
                'grid size-9 place-items-center rounded-full sm:size-10',
                cell.state === 'logged' && 'border border-brand-edge bg-brand text-on-brand',
                cell.state === 'logged' && cell.isToday && 'ring-2 ring-brand-ink ring-offset-2 ring-offset-surface',
                cell.state === 'no_spend' && 'border-2 border-brand-ink text-brand-ink',
                cell.state === 'pending' && 'border-2 border-brand-ink bg-brand-soft',
                cell.state === 'empty' && 'border-2 border-dashed border-field',
                celebrate && cell.isToday && 'motion-safe:animate-[cell-pop_420ms_var(--ease-spring)]',
              )}
            >
              {cell.state === 'logged' ? <Check className="icon-pop size-4" strokeWidth={2.5} aria-hidden /> : null}
              {cell.state === 'no_spend' ? <Leaf className="icon-pop size-4" aria-hidden /> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
