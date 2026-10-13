import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Stat tile: label · value · supporting lines. Big values keep proportional figures. */
export function StatTile({
  label,
  value,
  color,
  children,
  tone = 'default',
  size = 'md',
  className,
}: {
  label: string
  value: string
  color?: string
  children?: ReactNode
  tone?: 'default' | 'negative'
  size?: 'md' | 'sm'
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      <p className="flex items-center gap-2 text-sm text-ink-2">
        {color ? <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} /> : null}
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 font-semibold tracking-tight',
          size === 'md' ? 'text-[22px] sm:text-2xl' : 'text-lg',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </p>
      {children ? <div className="mt-1.5 space-y-0.5 text-xs text-muted">{children}</div> : null}
    </div>
  )
}
