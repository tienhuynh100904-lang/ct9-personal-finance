import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Replaces the browser's `title` tooltip with a small ink bubble. CSS only: it shows on hover
 * (mouse pointers) and on keyboard focus, never on touch where hover does not exist. It is
 * decorative (`aria-hidden`), so the trigger must carry its own accessible name.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  align = 'center',
  className,
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-50 hidden w-max max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug font-medium break-words text-surface opacity-0 shadow-[var(--shadow-2)] transition-opacity duration-150',
          'pointer-fine:block group-focus-within/tip:opacity-100 group-hover/tip:opacity-100 group-hover/tip:delay-300',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </span>
  )
}
