'use client'

import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { parseMonth } from '@/lib/dates'
import { MONTH_LABELS } from '@/lib/format'

export type MonthValue = number | 'all'

/**
 * The selected month lives in the URL (`?thang=10`) but switching it is a
 * shallow update: the page already holds the whole year, so nothing reloads.
 */
export function useMonthParam(defaultMonth: MonthValue) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('thang')
  const month: MonthValue = raw === 'all' ? 'all' : (parseMonth(raw ?? undefined) ?? defaultMonth)

  const setMonth = useCallback((value: MonthValue) => {
    const params = new URLSearchParams(window.location.search)
    params.set('thang', String(value))
    window.history.replaceState(null, '', `?${params}`)
  }, [])

  return [month, setMonth] as const
}

/** Changing the year loads that year's data from the server. */
export function useYearNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const goToYear = useCallback(
    (year: number, month?: MonthValue) => {
      const params = new URLSearchParams(window.location.search)
      params.set('nam', String(year))
      if (month !== undefined) params.set('thang', String(month))
      startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }))
    },
    [pathname, router],
  )

  return { goToYear, pending }
}

const controlClasses =
  'h-10 rounded-xl border border-line-strong bg-surface text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-3 focus-visible:ring-accent/25'

export function YearSelect({ year, years, className }: { year: number; years: number[]; className?: string }) {
  const { goToYear, pending } = useYearNavigation()
  return (
    <label className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">Chọn năm</span>
      <select
        value={year}
        onChange={(e) => goToYear(Number(e.target.value))}
        className={cn(controlClasses, 'appearance-none pr-9 pl-3')}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            Năm {y}
          </option>
        ))}
      </select>
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute right-3 size-4 animate-spin text-muted" aria-hidden />
      ) : (
        <ChevronRight className="pointer-events-none absolute right-3 size-4 rotate-90 text-muted" aria-hidden />
      )}
    </label>
  )
}

/** ‹ Tháng 10/2026 › — arrows step across year boundaries too. */
export function MonthSwitcher({
  year,
  month,
  onMonthChange,
  years,
  allowAll = false,
}: {
  year: number
  month: MonthValue
  onMonthChange: (month: MonthValue) => void
  years: number[]
  allowAll?: boolean
}) {
  const { goToYear, pending } = useYearNavigation()
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  function step(delta: -1 | 1) {
    if (month === 'all') {
      const target = year + delta
      if (target >= minYear && target <= maxYear) goToYear(target, 'all')
      return
    }
    const next = month + delta
    if (next >= 1 && next <= 12) onMonthChange(next)
    else if (next === 0 && year > minYear) goToYear(year - 1, 12)
    else if (next === 13 && year < maxYear) goToYear(year + 1, 1)
  }

  const atStart = month === 'all' ? year <= minYear : month === 1 && year <= minYear
  const atEnd = month === 'all' ? year >= maxYear : month === 12 && year >= maxYear

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atStart || pending}
        className={cn(controlClasses, 'grid w-10 place-items-center disabled:opacity-40')}
        aria-label={month === 'all' ? 'Năm trước' : 'Tháng trước'}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <label className="relative inline-flex items-center">
        <span className="sr-only">Chọn tháng</span>
        <select
          value={`${year}-${month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-')
            const value: MonthValue = m === 'all' ? 'all' : Number(m)
            if (Number(y) === year) onMonthChange(value)
            else goToYear(Number(y), value)
          }}
          className={cn(controlClasses, 'min-w-40 appearance-none pr-9 pl-3 text-center tabular-nums')}
        >
          {years.map((y) => (
            <optgroup key={y} label={`Năm ${y}`}>
              {allowAll ? <option value={`${y}-all`}>Cả năm {y}</option> : null}
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={`${y}-${i + 1}`}>
                  {label}/{y}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {pending ? (
          <LoaderCircle className="pointer-events-none absolute right-3 size-4 animate-spin text-muted" aria-hidden />
        ) : (
          <ChevronRight className="pointer-events-none absolute right-3 size-4 rotate-90 text-muted" aria-hidden />
        )}
      </label>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={atEnd || pending}
        className={cn(controlClasses, 'grid w-10 place-items-center disabled:opacity-40')}
        aria-label={month === 'all' ? 'Năm sau' : 'Tháng sau'}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  )
}
