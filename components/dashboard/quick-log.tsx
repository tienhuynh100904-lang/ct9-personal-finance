'use client'

import { CATEGORY_META } from '@/lib/categories'
import { openComposer } from '@/lib/composer'
import { formatCompact, formatVND } from '@/lib/format'
import type { Preset } from '@/lib/habit'

/**
 * One-tap re-log of what you spend on most: tapping a chip opens the entry sheet
 * with item, category and last amount filled in (amount selected, so typing replaces
 * it). Nothing is ever saved without confirming in the sheet.
 */
export function QuickLog({ presets }: { presets: Preset[] }) {
  if (presets.length === 0) return null
  return (
    <section aria-labelledby="quick-log-title">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="quick-log-title" className="text-sm font-semibold">
          Ghi nhanh
        </h2>
        <p className="text-xs text-muted">Chạm để ghi lại với số tiền lần trước</p>
      </div>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {presets.map((preset) => (
          <li key={preset.item} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() =>
                openComposer({
                  kind: 'expense',
                  preset: { item: preset.item, category: preset.category, amount: preset.amount },
                })
              }
              aria-label={`Ghi ${preset.item}, ${formatVND(preset.amount)}, ${CATEGORY_META[preset.category].label}`}
              className="h-14 min-w-28 max-w-44 rounded-2xl border border-line bg-surface px-3.5 text-left shadow-[var(--shadow-1)] transition-colors hover:bg-surface-2 active:bg-surface-2"
            >
              <span className="block truncate text-sm font-medium">{preset.item}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted tabular-nums">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[preset.category].color }} />
                {formatCompact(preset.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
