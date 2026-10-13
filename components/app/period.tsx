'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { MonthPicker, type MonthValue } from '@/components/ui/month-picker'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { parseMonth } from '@/lib/dates'

export type { MonthValue }

/**
 * The selected month lives in the URL (`?month=10`) but switching it is a
 * shallow update: the page already holds the whole year, so nothing reloads.
 */
export function useMonthParam(defaultMonth: MonthValue) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('month')
  const month: MonthValue = raw === 'all' ? 'all' : (parseMonth(raw ?? undefined) ?? defaultMonth)

  const setMonth = useCallback((value: MonthValue) => {
    const params = new URLSearchParams(window.location.search)
    params.set('month', String(value))
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
      params.set('year', String(year))
      if (month !== undefined) params.set('month', String(month))
      startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }))
    },
    [pathname, router],
  )

  return { goToYear, pending }
}

const arrowClasses =
  'group grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-3 focus-visible:ring-focus/30 active:bg-surface-2 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11'

export function YearSelect({ year, years, className }: { year: number; years: number[]; className?: string }) {
  const { goToYear, pending } = useYearNavigation()
  return (
    <Select
      label="Chọn năm"
      className={cn('w-44', className)}
      value={String(year)}
      loading={pending}
      options={years.map((y) => ({ value: String(y), label: `Năm ${y}` }))}
      onValueChange={(value) => goToYear(Number(value))}
      triggerClassName="h-10 pointer-coarse:h-11"
    />
  )
}

/** ‹ Tháng 10/2026 › — arrows step across year boundaries too; the middle button opens a month grid. */
export function MonthSwitcher({
  year,
  month,
  onMonthChange,
  years,
  allowAll = false,
  stretch = false,
}: {
  year: number
  month: MonthValue
  onMonthChange: (month: MonthValue) => void
  years: number[]
  allowAll?: boolean
  /** Fill the row on phones: the month button grows between the two arrows. */
  stretch?: boolean
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
    <div className={cn('flex items-center gap-1.5', stretch ? 'w-full sm:inline-flex sm:w-auto' : 'inline-flex')}>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atStart || pending}
        className={arrowClasses}
        aria-label={month === 'all' ? 'Năm trước' : 'Tháng trước'}
      >
        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      </button>
      <MonthPicker
        className={cn('min-w-0', stretch ? 'flex-1 sm:w-52 sm:flex-none' : 'w-52')}
        year={year}
        month={month}
        years={years}
        allowAll={allowAll}
        loading={pending}
        onChange={(nextYear, nextMonth) => (nextYear === year ? onMonthChange(nextMonth) : goToYear(nextYear, nextMonth))}
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={atEnd || pending}
        className={arrowClasses}
        aria-label={month === 'all' ? 'Năm sau' : 'Tháng sau'}
      >
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </div>
  )
}
