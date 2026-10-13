import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Replaces the browser's checkbox: a rounded box in the brand color with an animated tick. The
 * real <input> stays in the DOM (visually hidden) so keyboard, form and screen reader behavior are
 * native; the whole row is the tap target. `hint` adds a muted second line.
 */
export function Checkbox({
  children,
  hint,
  card = false,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'children'> & {
  /** The label. */
  children: ReactNode
  hint?: ReactNode
  /** Draws the row as a tinted card (a setting with an explanation). */
  card?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-2.5 text-sm text-ink-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
        card ? 'items-start rounded-xl bg-surface-2 p-3 text-ink' : 'min-h-11 items-center',
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md border border-field bg-surface text-on-brand transition-colors',
          'peer-checked:border-brand-edge peer-checked:bg-brand peer-focus-visible:ring-3 peer-focus-visible:ring-focus/30',
          'peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100',
          card && 'mt-px',
        )}
      >
        <Check className="size-3.5 scale-50 opacity-0 transition duration-150" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        {children}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  )
}
