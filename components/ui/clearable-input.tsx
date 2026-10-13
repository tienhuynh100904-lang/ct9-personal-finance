'use client'

import { X } from 'lucide-react'
import { useRef, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { inputClasses } from './field'

/**
 * Text input with the app's own clear button, shown while there is text. `icon` adds a leading
 * icon. Clearing returns focus to the field. Used directly for plain text fields and as the base
 * of <SearchInput>.
 */
export function ClearableInput({
  value,
  onValueChange,
  icon,
  clearLabel = 'Xoá nội dung',
  clearOnEscape = false,
  className,
  wrapperClassName,
  onKeyDown,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  icon?: ReactNode
  clearLabel?: string
  /** Escape empties the field (and is not passed on, so it does not also close a dialog). */
  clearOnEscape?: boolean
  wrapperClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('relative block', wrapperClassName)}>
      {icon ? (
        <span className="pointer-events-none absolute top-1/2 left-3 grid -translate-y-1/2 place-items-center text-muted" aria-hidden>
          {icon}
        </span>
      ) : null}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (clearOnEscape && e.key === 'Escape' && value) {
            e.preventDefault()
            e.stopPropagation()
            onValueChange('')
          }
        }}
        className={cn(inputClasses, 'pr-10', icon ? 'pl-9' : undefined, className)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onValueChange('')
            inputRef.current?.focus()
          }}
          aria-label={clearLabel}
          className="group absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-surface-2 pointer-coarse:size-10"
        >
          <X className="size-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
