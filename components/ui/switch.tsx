import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/**
 * On/off switch (role="switch"). The whole 44px-high row around the track is tappable so it works
 * with a thumb; the track itself is 48 x 28. Controlled: pass `checked` and `onCheckedChange`.
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'onChange' | 'role' | 'type'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'relative block h-7 w-12 rounded-full border transition-colors group-focus-visible:ring-3 group-focus-visible:ring-focus/30',
          checked ? 'border-brand-edge bg-brand' : 'border-field bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-[var(--shadow-1)] ring-1 ring-line-strong transition-transform duration-200 ease-[var(--ease-out)]',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
