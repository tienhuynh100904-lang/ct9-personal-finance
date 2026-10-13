'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addMonths, longDateLabel, MAX_DATE, MIN_DATE, monthGrid, parseISO, toISO, WEEKDAY_HEADERS } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { addDays } from '@/lib/habit'

const MONTH_ARROW =
  'group grid size-11 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 active:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent sm:size-10'

/**
 * Inline month calendar that replaces the browser's <input type="date">. Weeks start on Monday,
 * today is outlined, the chosen day is filled. Arrow keys move by day/week, PageUp/PageDown by
 * month, Home/End to the start/end of the week; Enter or Space picks. It is a plain block (not a
 * floating panel) so it works inside a scrolling dialog and a phone sheet alike.
 */
export function Calendar({
  value,
  onChange,
  today,
  label = 'Chọn ngày',
  className,
}: {
  /** The chosen day, `YYYY-MM-DD`. */
  value: string
  onChange: (iso: string) => void
  /** Today in app time; outlined in the grid. */
  today: string
  label?: string
  className?: string
}) {
  const [view, setView] = useState(() => {
    const { year, month } = parseISO(value)
    return { year, month }
  })
  const gridRef = useRef<HTMLDivElement>(null)
  // Set when a key press moves to a day in another month: focus it once that month is rendered.
  const pendingFocus = useRef<string | null>(null)

  // Follow the value when it changes from outside (e.g. the "Hôm qua" chip) so it is never off-screen.
  const [seenValue, setSeenValue] = useState(value)
  if (value !== seenValue) {
    setSeenValue(value)
    const { year, month } = parseISO(value)
    if (year !== view.year || month !== view.month) setView({ year, month })
  }

  useEffect(() => {
    if (!pendingFocus.current) return
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${pendingFocus.current}"]`)?.focus()
    pendingFocus.current = null
  }, [view])

  const weeks = monthGrid(view.year, view.month)
  // Always six rows so the dialog does not change height when browsing months.
  while (weeks.length < 6) weeks.push(Array.from({ length: 7 }, () => null))

  const monthStart = toISO(view.year, view.month, 1)
  const inView = (iso: string) => iso.startsWith(monthStart.slice(0, 7))
  // One tab stop for the whole grid (roving): the chosen day, or else the 1st of the month.
  const tabStop = inView(value) ? value : monthStart

  const prevDisabled = addMonths(monthStart, -1) < MIN_DATE.slice(0, 7) + '-01'
  const nextDisabled = addMonths(monthStart, 1) > MAX_DATE

  function showMonth(delta: number) {
    const next = addMonths(monthStart, delta)
    const { year, month } = parseISO(next)
    setView({ year, month })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = (document.activeElement as HTMLElement | null)?.dataset.date
    if (!current) return
    const weekday = (new Date(`${current}T00:00:00Z`).getUTCDay() + 6) % 7
    const moves: Record<string, string> = {
      ArrowLeft: addDays(current, -1),
      ArrowRight: addDays(current, 1),
      ArrowUp: addDays(current, -7),
      ArrowDown: addDays(current, 7),
      Home: addDays(current, -weekday),
      End: addDays(current, 6 - weekday),
      PageUp: addMonths(current, -1),
      PageDown: addMonths(current, 1),
    }
    const target = moves[event.key]
    if (!target) return
    event.preventDefault()
    if (target < MIN_DATE || target > MAX_DATE) return
    if (inView(target)) {
      gridRef.current?.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus()
    } else {
      pendingFocus.current = target
      const { year, month } = parseISO(target)
      setView({ year, month })
    }
  }

  return (
    <div className={cn('select-none', className)}>
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={() => showMonth(-1)} disabled={prevDisabled} aria-label="Tháng trước" className={MONTH_ARROW}>
          <ChevronLeft className="size-5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        </button>
        <p aria-live="polite" className="text-base font-semibold tabular-nums">
          Tháng {view.month}/{view.year}
        </p>
        <button type="button" onClick={() => showMonth(1)} disabled={nextDisabled} aria-label="Tháng sau" className={MONTH_ARROW}>
          <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>

      <div aria-hidden className="grid grid-cols-7 text-center text-xs font-medium text-muted">
        {WEEKDAY_HEADERS.map((name, i) => (
          <span key={name} className={cn('py-1.5', i === 6 && 'text-negative/80')}>
            {name}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="group" aria-label={label} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-y-1">
        {weeks.flat().map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} aria-hidden className="h-11 sm:h-10" />
          const selected = iso === value
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              tabIndex={iso === tabStop ? 0 : -1}
              aria-label={longDateLabel(iso)}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onChange(iso)}
              className={cn(
                'mx-auto grid h-11 w-11 place-items-center rounded-full text-[15px] tabular-nums transition-colors sm:h-10 sm:w-10 sm:text-sm',
                selected
                  ? 'bg-brand font-semibold text-on-brand'
                  : isToday
                    ? 'border border-brand-edge font-semibold text-brand-ink hover:bg-brand-soft active:bg-brand-soft'
                    : 'text-ink hover:bg-surface-2 active:bg-surface-2',
              )}
            >
              {parseISO(iso).day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
