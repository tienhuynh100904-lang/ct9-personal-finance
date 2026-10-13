import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Stat tile: label · value · supporting lines. Big values keep proportional figures.
 * The tile is a container, so the value scales with the tile's own width and a 9-digit
 * amount never overflows a 2-column phone grid.
 */
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
    <div className={cn('@container min-w-0 rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-1)] sm:p-4', className)}>
      <p className="flex items-center gap-2 text-sm text-ink-2">
        {color ? <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} /> : null}
        <span className="min-w-0">{label}</span>
      </p>
      <p
        className={cn(
          'mt-1.5 font-semibold tracking-tight break-words tabular-nums',
          size === 'md' ? 'text-lg @[10rem]:text-xl @[13rem]:text-2xl' : 'text-base @[10rem]:text-lg',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </p>
      {children ? <div className="mt-1.5 space-y-0.5 text-xs text-muted">{children}</div> : null}
    </div>
  )
}
