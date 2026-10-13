'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Page numbers to show: always first and last, a window around the current page, "…" gaps. */
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

const buttonBase =
  'group grid h-10 min-w-10 place-items-center rounded-xl px-2 text-sm font-medium transition-colors pointer-coarse:h-11 pointer-coarse:min-w-11'

/**
 * Previous / next with numbered pages on wider screens, and a compact "Trang 2 / 5" on phones.
 * Renders nothing when everything fits on one page.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = 'Phân trang',
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  label?: string
}) {
  if (pageCount <= 1) return null

  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
        className={cn(buttonBase, 'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2 disabled:opacity-40')}
      >
        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      </button>

      <p className="min-w-24 text-center text-sm tabular-nums text-ink-2 sm:hidden" aria-live="polite">
        Trang {page} / {pageCount}
      </p>

      <ul className="hidden items-center gap-1.5 sm:flex">
        {pageWindow(page, pageCount).map((entry, i) =>
          entry === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                onClick={() => onPageChange(entry)}
                aria-label={`Trang ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  buttonBase,
                  'tabular-nums',
                  entry === page
                    ? 'border border-brand-edge bg-brand text-on-brand'
                    : 'text-ink-2 hover:bg-surface-2 active:bg-surface-2',
                )}
              >
                {entry}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Trang sau"
        className={cn(buttonBase, 'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2 disabled:opacity-40')}
      >
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </nav>
  )
}
