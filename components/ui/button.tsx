import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/85',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-[#c53030] text-white hover:bg-[#a82828]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-base',
  icon: 'size-10 rounded-xl',
  'icon-sm': 'size-8 rounded-lg',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size }

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}
