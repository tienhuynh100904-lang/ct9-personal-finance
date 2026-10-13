'use client'

import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, LoaderCircle } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { Popover } from './popover'

export type MonthValue = number | 'all'

const triggerClasses =
  'flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-3 focus-visible:ring-focus/30 active:bg-surface-2 pointer-coarse:h-11'

/**
 * Month chooser: a 12-month grid with year arrows instead of a 36-row list. Picking a month in
 * another year switches both at once. A floating panel on desktop, a bottom sheet on phones.
 */
export function MonthPicker({
  year,
  month,
  years,
  allowAll = false,
  compact = false,
  loading = false,
  label = 'Chọn tháng',
  onChange,
  className,
}: {
  year: number
  month: MonthValue
  /** Years that can be browsed. */
  years: number[]
  /** Offers a "Cả năm" choice. */
  allowAll?: boolean
  /** Shows "Tháng 10" instead of "Tháng 10/2026" (when the year is shown elsewhere). */
  compact?: boolean
  loading?: boolean
  label?: string
  onChange: (year: number, month: MonthValue) => void
  className?: string
}) {
  const text = month === 'all' ? `Cả năm ${year}` : compact ? `Tháng ${month}` : `Tháng ${month}/${year}`

  return (
    <Popover
      label={label}
      className={className}
      panelWidth={304}
      panelHeight={allowAll ? 360 : 312}
      panelClassName="w-[19rem]"
      trigger={({ open, ...props }) => (
        <button type="button" {...props} className={cn(triggerClasses, open && 'border-focus ring-3 ring-focus/25')}>
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 truncate tabular-nums">{text}</span>
          {loading ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
          ) : (
            <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          )}
        </button>
      )}
    >
      {(close) => (
        <MonthGrid
          selectedYear={year}
          selectedMonth={month}
          years={years}
          allowAll={allowAll}
          onPick={(nextYear, nextMonth) => {
            if (nextYear !== year || nextMonth !== month) onChange(nextYear, nextMonth)
            close()
          }}
        />
      )}
    </Popover>
  )
}

function MonthGrid({
  selectedYear,
  selectedMonth,
  years,
  allowAll,
  onPick,
}: {
  selectedYear: number
  selectedMonth: MonthValue
  years: number[]
  allowAll: boolean
  onPick: (year: number, month: MonthValue) => void
}) {
  const minYear = Math.min(...years, selectedYear)
  const maxYear = Math.max(...years, selectedYear)
  // Browsing years inside the panel does not change anything until a month is chosen.
  const [viewYear, setViewYear] = useState(selectedYear)
  const gridRef = useRef<HTMLDivElement>(null)

  const isSelected = (m: MonthValue) => viewYear === selectedYear && m === selectedMonth
  const tabStop: MonthValue = viewYear === selectedYear ? selectedMonth : allowAll ? 'all' : 1

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...(gridRef.current?.querySelectorAll<HTMLElement>('button[role="radio"]') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    if (index < 0) return
    const columns = 3
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    buttons[Math.max(0, Math.min(buttons.length - 1, index + delta))]?.focus()
  }

  const cell = (m: number) => (
    <button
      key={m}
      type="button"
      role="radio"
      aria-checked={isSelected(m)}
      // One tab stop for the whole group (roving), like a native radio group.
      tabIndex={m === tabStop ? 0 : -1}
      data-autofocus={isSelected(m) ? '' : undefined}
      onClick={() => onPick(viewYear, m)}
      className={cn(
        'h-12 rounded-xl border text-[15px] font-medium transition-colors sm:h-11 sm:text-sm',
        isSelected(m)
          ? 'border-brand-edge bg-brand text-on-brand'
          : 'border-transparent bg-surface-2 text-ink hover:bg-surface-3 active:bg-surface-3',
      )}
    >
      Tháng {m}
    </button>
  )

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewYear((y) => y - 1)}
          disabled={viewYear <= minYear}
          aria-label="Năm trước"
          className="group grid size-11 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 active:bg-surface-2 disabled:opacity-30 sm:size-10"
        >
          <ChevronLeft className="size-5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        </button>
        <p aria-live="polite" className="text-base font-semibold tabular-nums">
          Năm {viewYear}
        </p>
        <button
          type="button"
          onClick={() => setViewYear((y) => y + 1)}
          disabled={viewYear >= maxYear}
          aria-label="Năm sau"
          className="group grid size-11 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 active:bg-surface-2 disabled:opacity-30 sm:size-10"
        >
          <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>

      <div ref={gridRef} role="radiogroup" aria-label={`Tháng của năm ${viewYear}`} onKeyDown={onKeyDown} className="grid grid-cols-3 gap-2">
        {allowAll ? (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected('all')}
            tabIndex={tabStop === 'all' ? 0 : -1}
            data-autofocus={isSelected('all') ? '' : undefined}
            onClick={() => onPick(viewYear, 'all')}
            className={cn(
              'col-span-3 h-12 rounded-xl border text-[15px] font-medium transition-colors sm:h-11 sm:text-sm',
              isSelected('all')
                ? 'border-brand-edge bg-brand text-on-brand'
                : 'border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2',
            )}
          >
            Cả năm {viewYear}
          </button>
        ) : null}
        {Array.from({ length: 12 }, (_, i) => cell(i + 1))}
      </div>
    </div>
  )
}
