'use client'

import { ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import { formatDate, formatSignedVND } from '@/lib/format'
import type { TransactionRecord } from '@/lib/types'

/** One transaction; tapping it opens the edit dialog. */
export function TransactionRow({
  transaction: t,
  showDate = false,
  onSelect,
}: {
  transaction: TransactionRecord
  showDate?: boolean
  /** Replaces the default "open the edit dialog" (used when the row lives inside another dialog). */
  onSelect?: (transaction: TransactionRecord) => void
}) {
  const meta = CATEGORY_META[t.category]
  const isIncome = t.kind === 'income'
  const Icon = isIncome ? ArrowDownLeft : t.category === 'saving' ? PiggyBank : ArrowUpRight

  return (
    <li>
      <button
        type="button"
        onClick={() =>
          onSelect
            ? onSelect(t)
            : openComposer({
            transaction: {
              id: t.id,
              kind: t.kind,
              item: t.item,
              category: t.category,
              amount: t.amount,
              occurred_on: t.occurred_on,
              note: t.note,
            },
          })
        }
        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-2 sm:px-3"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            isIncome ? 'bg-income/12 text-positive' : 'bg-surface-2 text-ink-2',
          )}
        >
          <Icon className="size-[18px] transition-transform duration-200 group-hover:scale-110" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{t.item}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
            <span className="min-w-0 truncate">{meta.label}</span>
            {showDate ? <span className="shrink-0">· {formatDate(t.occurred_on)}</span> : null}
            {t.note && !showDate ? <span className="hidden min-w-0 truncate sm:inline">· {t.note}</span> : null}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            isIncome ? 'text-positive' : 'text-ink',
          )}
        >
          {formatSignedVND(isIncome ? t.amount : -t.amount)}
        </span>
      </button>
    </li>
  )
}
