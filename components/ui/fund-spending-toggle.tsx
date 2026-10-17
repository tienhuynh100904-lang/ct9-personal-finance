'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatVND } from '@/lib/format'
import { useLocalValue, writeLocalValue } from '@/lib/use-local-value'

const KEY = 'ct9-surplus-includes-fund'

/**
 * Whether the surplus counts spending paid from savings goals ("Chi từ quỹ"). Off by default: that
 * money was saved earlier, so it should not make the month look overspent. Saved per device and
 * shared by every surplus on screen (Tổng quan, Phân tích).
 */
export function useIncludeFundSpending(): boolean {
  return useLocalValue(KEY) === '1'
}

/** The tick under a surplus figure; shown only when there is spending from goals to count. */
export function FundSpendingToggle({ amount, include }: { amount: number; include: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={include}
      onClick={() => writeLocalValue(KEY, include ? '0' : '1')}
      className="group -mx-1 mt-1 inline-flex min-h-8 items-start gap-1.5 rounded-lg px-1 py-1 text-left text-xs text-ink-2 hover:bg-surface-2 hover:text-ink pointer-coarse:min-h-10"
      title="Chi từ quỹ là tiền đã để dành từ trước. Bỏ tick: thặng dư chỉ tính chi tiêu từ thu nhập của tháng."
    >
      <span
        aria-hidden
        className={cn(
          'mt-px grid size-3.5 shrink-0 place-items-center rounded border transition-colors',
          include ? 'border-brand-edge bg-brand text-on-brand' : 'border-field bg-surface',
        )}
      >
        {include ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
      </span>
      <span>
        Tính cả chi từ quỹ <span className="tabular-nums">({formatVND(amount)})</span>
      </span>
    </button>
  )
}
