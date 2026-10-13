'use client'

import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { inputClasses } from './field'
import { Popover } from './popover'

export type SelectOption = {
  value: string
  label: ReactNode
  /** Color dot shown before the label (a category color). */
  dot?: string
  /** Secondary line under the label. */
  hint?: string
}

/**
 * Replaces the browser's <select>: a styled trigger plus a list of large rows, a floating panel
 * on desktop and a bottom sheet on phones. Fully keyboard operable (arrows, Home/End, Enter, Esc).
 */
export function Select({
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Chọn…',
  loading = false,
  disabled = false,
  className,
  triggerClassName,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  /** Accessible name; also the title of the phone sheet. */
  label: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  triggerClassName?: string
}) {
  const selected = options.find((o) => o.value === value)
  const expectedHeight = Math.min(options.length * 44 + 16, 352)

  return (
    <Popover
      label={label}
      className={className}
      panelWidth={240}
      panelHeight={expectedHeight}
      panelClassName="min-w-full w-max max-w-[min(22rem,calc(100vw-2rem))]"
      trigger={({ open, ...props }) => (
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label}: ${selected ? textOf(selected.label) : placeholder}`}
          {...props}
          className={cn(
            inputClasses,
            'flex items-center justify-between gap-2 text-left',
            open && 'border-focus ring-3 ring-focus/25',
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.dot ? <Dot color={selected.dot} /> : null}
            <span className={cn('min-w-0 truncate', !selected && 'text-muted')}>{selected ? selected.label : placeholder}</span>
          </span>
          {loading ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
          ) : (
            <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          )}
        </button>
      )}
    >
      {(close) => (
        <OptionList
          label={label}
          options={options}
          value={value}
          onPick={(next) => {
            if (next !== value) onValueChange(next)
            close()
          }}
        />
      )}
    </Popover>
  )
}

function textOf(label: ReactNode): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : ''
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

function OptionList({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: SelectOption[]
  value: string
  onPick: (value: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // Focus the current choice (or the first row) when the list opens.
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const current = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(current ?? rows?.[0])?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLElement)
    const go = (next: number) => {
      event.preventDefault()
      rows[(next + rows.length) % rows.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(index + 1)
    else if (event.key === 'ArrowUp') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(rows.length - 1)
  }

  return (
    <div ref={listRef} role="listbox" aria-label={label} onKeyDown={onKeyDown} className="p-1.5">
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onPick(option.value)}
            className={cn(
              'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] transition-colors sm:text-sm',
              isSelected ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink hover:bg-surface-2 focus-visible:bg-surface-2 active:bg-surface-2',
            )}
          >
            {option.dot ? <Dot color={option.dot} /> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{option.label}</span>
              {option.hint ? <span className="block truncate text-xs font-normal text-muted">{option.hint}</span> : null}
            </span>
            {isSelected ? <Check className="icon-pop size-4 shrink-0" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}
