'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tab<T extends string> = { value: T; label: ReactNode; count?: number }

export const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`
export const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`

/**
 * Page-level tabs. The caller renders the active panel with `role="tabpanel"`, `id={panelId(prefix, value)}`
 * and `aria-labelledby={tabId(prefix, value)}`. Arrow keys, Home and End move between tabs.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  idPrefix,
  className,
}: {
  value: T
  onChange: (value: T) => void
  tabs: Tab<T>[]
  label: string
  idPrefix: string
  className?: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.value === value)
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    onChange(tabs[next].value)
    document.getElementById(tabId(idPrefix, tabs[next].value))?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1 sm:inline-grid', className)}>
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            id={tabId(idPrefix, tab.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:h-11',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn('min-w-5 rounded-full px-1.5 text-xs leading-5 tabular-nums', selected ? 'bg-brand-soft text-brand-ink' : 'bg-surface-3 text-muted')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
