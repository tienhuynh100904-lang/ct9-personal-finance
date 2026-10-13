import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'brand' | 'danger' | 'danger-ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<Variant, string> = {
  // The thin edge keeps the light gold button visible on a white card (gold on white is only ~1.4:1).
  primary: 'border border-brand-edge bg-brand text-on-brand hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3 active:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-2',
  /** Quiet action in the brand color (e.g. "Hôm nay không chi tiêu"). */
  brand: 'text-brand-ink hover:bg-brand-soft active:bg-brand-soft',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  /** Destructive but quiet (e.g. "Xoá" next to the main action). */
  'danger-ghost': 'text-negative hover:bg-surface-2 active:bg-surface-2',
}

// Height and radius per size. Coarse pointers (phones, tablets) get >= 44px targets.
const SIZES: Record<Size, string> = {
  sm: 'h-8 rounded-lg pointer-coarse:h-10',
  md: 'h-10 rounded-xl pointer-coarse:h-11',
  lg: 'h-12 rounded-xl',
  icon: 'size-10 rounded-xl pointer-coarse:size-11',
  'icon-sm': 'size-8 rounded-lg pointer-coarse:size-10',
}

// Horizontal padding and text size. Tailwind resolves conflicting utilities by stylesheet
// order, not class order, so these are chosen here instead of overridden by callers.
const PADDING: Record<Size, string> = {
  sm: 'px-3 text-sm',
  md: 'px-4 text-sm',
  lg: 'px-5 text-base',
  icon: '',
  'icon-sm': '',
}
const COMPACT_PADDING = 'px-3 text-sm'

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string, compact = false) {
  return cn(
    'group inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    compact && PADDING[size] ? COMPACT_PADDING : PADDING[size],
    className,
  )
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  /** Tighter padding and smaller text, for two buttons side by side on a 360px phone. */
  compact?: boolean
}

export function Button({ variant, size, compact, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className, compact)} {...props} />
}
