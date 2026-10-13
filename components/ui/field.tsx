import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 16px text on phones prevents iOS from zooming into focused inputs. */
export const inputClasses =
  'h-11 w-full rounded-xl border border-field bg-surface px-3 text-base text-ink placeholder:text-muted transition-colors focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/25 aria-[invalid=true]:border-negative disabled:opacity-60 sm:text-sm'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-ink-2', className)} {...props} />
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClasses, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClasses, 'h-auto min-h-20 py-2.5 leading-relaxed', className)} {...props} />
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-negative">
      {children}
    </p>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode
  htmlFor: string
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
