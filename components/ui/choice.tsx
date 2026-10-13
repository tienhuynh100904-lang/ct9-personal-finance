'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Option<T extends string> = { value: T; label: ReactNode; dot?: string }

/** A row of mutually exclusive pill buttons (radio semantics). */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T | null
  onChange: (value: T) => void
  options: Option<T>[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
              selected
                ? 'border-ink bg-ink font-medium text-surface'
                : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {option.dot ? (
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-2 ring-surface"
                style={{ background: option.dot }}
              />
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Two or three equal segments — used for the income / expense switch. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; activeClass?: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
              selected ? cn('bg-surface shadow-sm', option.activeClass ?? 'text-ink') : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
