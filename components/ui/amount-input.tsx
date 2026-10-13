'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { formatNumber, parseAmount } from '@/lib/format'
import { MAX_AMOUNT } from '@/lib/validation'
import { inputClasses } from './field'

type AmountInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number
  onValueChange: (value: number) => void
  /** Shows a "000" key that multiplies by 1.000 — handy when typing on a phone. */
  showThousands?: boolean
}

/** Money input that keeps dot thousands separators while typing: 1250000 → "1.250.000". */
export function AmountInput({ value, onValueChange, showThousands = true, className, ...props }: AmountInputProps) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={value ? formatNumber(value) : ''}
        onChange={(e) => onValueChange(Math.min(parseAmount(e.target.value), MAX_AMOUNT))}
        className={cn(inputClasses, 'tabular-nums', showThousands ? 'pr-24' : 'pr-9', className)}
        {...props}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
        {showThousands ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={!value || value * 1000 > MAX_AMOUNT}
            onClick={() => onValueChange(value * 1000)}
            className="h-7 rounded-md bg-surface-2 px-2 text-xs font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-40"
            aria-label="Thêm 3 số 0"
          >
            000
          </button>
        ) : null}
        <span className="pr-1 text-sm text-muted" aria-hidden>
          ₫
        </span>
      </div>
    </div>
  )
}
