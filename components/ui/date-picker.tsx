'use client'

import { CalendarDays, ChevronDown } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { longDateLabel, MAX_DATE, MIN_DATE } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/dates'
import { inputClasses } from './field'

/**
 * Date field in the app's style, replacing the browser's `<input type="date">` (whose look and
 * language differ per phone): a field-like button showing "Thứ sáu, 17/10/2026" that unfolds the
 * month calendar right below it. Inline rather than floating, like "Ngày khác" in the entry sheet,
 * so it is never clipped by a scrolling dialog and never stacks a sheet on top of a sheet.
 * Picking a day folds it again; `min` / `max` grey out the days that cannot be chosen.
 */
export function DatePicker({
  id,
  value,
  onChange,
  label,
  min = MIN_DATE,
  max = MAX_DATE,
  disabled = false,
  invalid = false,
  className,
}: {
  /** Lets a <Field htmlFor> label point at the trigger. */
  id?: string
  /** `YYYY-MM-DD`. */
  value: string
  onChange: (iso: string) => void
  /** Names the calendar for screen readers. */
  label: string
  min?: string
  max?: string
  disabled?: boolean
  /** Red border; the message itself comes from the surrounding <Field error>. */
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const today = todayISO()
  const canPickToday = today >= min && today <= max

  function pick(iso: string) {
    onChange(iso)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      className={className}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        // Close only the calendar, not the dialog around it (focus may be on the trigger or a day).
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={`${label}: ${longDateLabel(value)}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(inputClasses, 'flex items-center gap-2 text-left', invalid && 'border-negative', open && 'border-focus ring-3 ring-focus/25')}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate tabular-nums">{longDateLabel(value)}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div id={panelId} className="rise-in mt-2 rounded-2xl border border-line bg-surface-2/60 p-2 sm:p-3">
          <Calendar value={value} today={today} min={min} max={max} label={label} onChange={pick} />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
            <p className="min-w-0 truncate text-sm font-medium text-ink-2">{longDateLabel(value)}</p>
            {canPickToday && value !== today ? (
              <button
                type="button"
                onClick={() => pick(today)}
                className="inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-brand-ink hover:bg-brand-soft"
              >
                Hôm nay
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
