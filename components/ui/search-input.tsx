'use client'

import { Search } from 'lucide-react'
import { ClearableInput } from './clearable-input'

/**
 * Search box: a magnifier, the app's own clear button (the browser's "×" is hidden in
 * globals.css) and Escape to clear. `className` sizes the box (e.g. `h-10`); the wrapper takes
 * `wrapperClassName`.
 */
export function SearchInput({
  value,
  onValueChange,
  label,
  placeholder,
  className,
  wrapperClassName,
}: {
  value: string
  onValueChange: (value: string) => void
  /** Accessible name (not shown). */
  label: string
  placeholder?: string
  className?: string
  wrapperClassName?: string
}) {
  return (
    <ClearableInput
      type="search"
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      icon={<Search className="size-4" />}
      clearLabel="Xoá tìm kiếm"
      clearOnEscape
      enterKeyHint="search"
      placeholder={placeholder}
      className={className}
      wrapperClassName={wrapperClassName}
    />
  )
}
