'use client'

import { CircleAlert, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { daysInMonth } from '@/lib/calendar'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { alertsSignature, type BudgetAlert } from '@/lib/finance'
import { formatPercent, formatVND } from '@/lib/format'
import { useLocalValue, writeLocalValue } from '@/lib/use-local-value'

const DISMISS_KEY = 'ct9-budget-alerts-dismissed'

/**
 * "Cảnh báo ngân sách": the spending groups of the viewed month that reached 80% of their plan or
 * went over. Dismissing hides it until a new group reaches a threshold (or one goes from 80% to over).
 */
export function BudgetAlerts({
  alerts,
  year,
  month,
  today,
}: {
  alerts: BudgetAlert[]
  year: number
  month: number
  /** Today (`YYYY-MM-DD`): for the viewed month being the current one, "còn X ngày" is shown. */
  today: string
}) {
  const dismissed = useLocalValue(DISMISS_KEY)
  const stamp = `${year}-${month}|${alertsSignature(alerts)}`
  // `undefined` = not hydrated yet: wait, so a dismissed banner never flashes in.
  if (alerts.length === 0 || dismissed === undefined || dismissed === stamp) return null

  const anyOver = alerts.some((a) => a.level === 'over')
  const isCurrentMonth = today.startsWith(`${year}-${String(month).padStart(2, '0')}`)
  const daysLeft = isCurrentMonth ? daysInMonth(year, month) - Number(today.slice(8)) + 1 : 0
  const Icon = anyOver ? CircleAlert : TriangleAlert

  return (
    <section
      aria-labelledby="budget-alerts-title"
      className={cn(
        'rise-in rounded-2xl border p-4 shadow-[var(--shadow-1)] sm:p-5',
        anyOver
          ? 'border-[color-mix(in_oklab,var(--s-critical)_35%,transparent)] bg-[color-mix(in_oklab,var(--s-critical)_6%,var(--surface))]'
          : 'border-[color-mix(in_oklab,var(--s-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-warning)_9%,var(--surface))]',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            anyOver ? 'bg-[color-mix(in_oklab,var(--s-critical)_14%,var(--surface))] text-negative' : 'bg-[color-mix(in_oklab,var(--s-warning)_22%,var(--surface))] text-warning',
          )}
        >
          <Icon className={cn('size-5', anyOver ? 'icon-shake' : 'icon-swing')} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="budget-alerts-title" className="text-[15px] font-semibold tracking-tight">
            Cảnh báo ngân sách tháng {month}
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {alerts.length === 1 ? '1 nhóm chi cần chú ý' : `${alerts.length} nhóm chi cần chú ý`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => writeLocalValue(DISMISS_KEY, stamp)}
          className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Ẩn cảnh báo ngân sách"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="mt-4 space-y-4">
        {alerts.map((alert) => {
          const over = alert.level === 'over'
          const remaining = alert.planned - alert.actual
          const perDay = daysLeft > 0 ? remaining / daysLeft : 0
          return (
            <li key={alert.category}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[alert.category].color }} />
                  <span>{CATEGORY_META[alert.category].label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      over
                        ? 'bg-[color-mix(in_oklab,var(--s-critical)_14%,var(--surface))] text-negative'
                        : 'bg-[color-mix(in_oklab,var(--s-warning)_22%,var(--surface))] text-warning',
                    )}
                  >
                    {over ? 'Đã vượt' : 'Sắp hết'}
                  </span>
                </span>
                <span className="ml-auto tabular-nums text-ink-2">
                  {formatVND(alert.actual)}
                  <span className="text-muted"> / {formatVND(alert.planned)}</span>
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                role="meter"
                aria-label={`${CATEGORY_META[alert.category].label}: đã dùng ${formatPercent(alert.used, 0)} ngân sách`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(alert.used, 1) * 100)}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.min(alert.used, 1) * 100}%`, background: over ? 'var(--s-critical)' : 'var(--s-warning)' }}
                />
              </div>
              <p className={cn('mt-1.5 text-xs', over ? 'text-negative' : 'text-warning')}>
                {over
                  ? `Vượt ${formatVND(-remaining)} · đã dùng ${formatPercent(alert.used, 0)}`
                  : `Đã dùng ${formatPercent(alert.used, 0)} · còn ${formatVND(remaining)}`}
                {!over && daysLeft > 0 ? (
                  <span className="text-muted">
                    {' '}
                    · khoảng {formatVND(Math.floor(perDay / 1000) * 1000)}/ngày cho {daysLeft} ngày còn lại
                  </span>
                ) : null}
              </p>
            </li>
          )
        })}
      </ul>

      <Link
        href={`/budget?year=${year}&month=${month}`}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand-ink hover:underline"
      >
        Xem và điều chỉnh ngân sách →
      </Link>
    </section>
  )
}
