'use client'

import { ArrowRight, Inbox } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { MonthSwitcher, useMonthParam } from '@/components/app/period'
import { CashflowChart } from '@/components/charts/cashflow-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { RankedBars } from '@/components/charts/ranked-bars'
import { TransactionRow } from '@/components/transactions/transaction-row'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { BudgetMeter } from '@/components/ui/meter'
import { FundSpendingToggle, useIncludeFundSpending } from '@/components/ui/fund-spending-toggle'
import { StatTile } from '@/components/ui/stat-tile'
import { CATEGORY_META, MEASURE_COLOR } from '@/lib/categories'
import { openComposer } from '@/lib/composer'
import type { RecurringData } from '@/lib/data'
import {
  budgetAlerts,
  buildBudgetPlan,
  buildYearReport,
  monthOf,
  monthSnapshot,
  ratio,
  SPENDING_CATEGORIES,
  topExpenseItems,
  type BudgetRow,
} from '@/lib/finance'
import { formatPercent, formatSignedVND, formatVND } from '@/lib/format'
import { recentPresets } from '@/lib/habit'
import type { HabitData, TransactionRecord } from '@/lib/types'
import { BudgetAlerts } from './budget-alerts'
import { QuickLog } from './quick-log'
import { RecurringCard } from './recurring-card'
import { TodayCard } from './today-card'

function progressText(actual: number, planned: number, noun: string) {
  if (planned <= 0) return `Chưa đặt ${noun}`
  return `${formatPercent(ratio(actual, planned), 0)} ${noun} ${formatVND(planned)}`
}

/**
 * Phone order is the DOM order: today's habit card first (the reason to open the app),
 * then one-tap logging, then the month in numbers, what was just logged, and the analysis.
 */
export function DashboardView({
  year,
  years,
  defaultMonth,
  transactions,
  budgetRows,
  habit,
  recurring,
}: {
  year: number
  years: number[]
  defaultMonth: number
  transactions: TransactionRecord[]
  budgetRows: BudgetRow[]
  habit: HabitData
  /** `null` when the recurring tables do not exist yet (schema.sql not re-run): the card is hidden. */
  recurring: RecurringData | null
}) {
  const [monthParam, setMonth] = useMonthParam(defaultMonth)
  const month = monthParam === 'all' ? defaultMonth : monthParam
  const current = { year: Number(habit.today.slice(0, 4)), month: Number(habit.today.slice(5, 7)) }

  const includeFundSpending = useIncludeFundSpending()
  const report = useMemo(() => buildYearReport(transactions, year, { includeFundSpending }), [transactions, year, includeFundSpending])
  const plan = useMemo(() => buildBudgetPlan(budgetRows), [budgetRows])
  const snapshot = monthSnapshot(report, plan, month)
  const alerts = budgetAlerts(snapshot.spendingByCategory)
  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthOf(t.occurred_on) === month),
    [transactions, month],
  )
  const topItems = useMemo(() => topExpenseItems(transactions, year, { month }), [transactions, year, month])
  const presets = useMemo(() => recentPresets(habit.transactions, habit.today), [habit.transactions, habit.today])

  return (
    <div className="space-y-4">
      <TodayCard habit={habit} />
      {recurring ? <RecurringCard data={recurring} /> : null}
      <QuickLog presets={presets} />

      <div className="flex flex-wrap items-center gap-3">
        <MonthSwitcher year={year} month={month} onMonthChange={setMonth} years={years} current={current} stretch />
      </div>

      <BudgetAlerts alerts={alerts} year={year} month={month} today={habit.today} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Thu nhập" value={formatVND(snapshot.income)} color={MEASURE_COLOR.income}>
          <p>{progressText(snapshot.income, snapshot.planned.income, 'dự kiến')}</p>
        </StatTile>
        <StatTile label="Chi tiêu" value={formatVND(snapshot.spending)} color={MEASURE_COLOR.spending}>
          <p>{progressText(snapshot.spending, snapshot.planned.spending, 'ngân sách')}</p>
        </StatTile>
        <StatTile label="Tiết kiệm/Đầu tư" value={formatVND(snapshot.saving)} color={MEASURE_COLOR.saving}>
          <p>{progressText(snapshot.saving, snapshot.planned.saving, 'mục tiêu')}</p>
          <p className="hidden sm:block">Thực tế tiết kiệm: {formatPercent(snapshot.actualSavingRate)} thu nhập</p>
        </StatTile>
        <StatTile
          label="Thặng dư"
          value={snapshot.surplus < 0 ? formatSignedVND(snapshot.surplus) : formatVND(snapshot.surplus)}
          tone={snapshot.surplus < 0 ? 'negative' : 'default'}
        >
          <p className="hidden sm:block">= Thu nhập − Chi tiêu − Tiết kiệm</p>
          <p>Có thể tiết kiệm: {formatPercent(snapshot.potentialSavingRate)} thu nhập</p>
          {snapshot.fundSpending > 0 ? <FundSpendingToggle amount={snapshot.fundSpending} include={includeFundSpending} /> : null}
        </StatTile>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Giao dịch gần đây"
            description={`${monthTransactions.length} giao dịch trong tháng ${month}`}
            action={
              <Link
                href={`/transactions?year=${year}&month=${month}`}
                className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-ink hover:underline"
              >
                Xem tất cả <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </Link>
            }
          />
          <div className="px-2 pt-2 pb-3 sm:px-3">
            {monthTransactions.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={`Chưa có giao dịch tháng ${month}`}
                action={
                  habit.hasAnyTransaction ? <Button onClick={() => openComposer({ kind: 'expense' })}>Ghi khoản chi</Button> : undefined
                }
              >
                Khoản đầu tiên chỉ mất vài giây.
              </EmptyState>
            ) : (
              <ul>
                {monthTransactions.slice(0, 5).map((t) => (
                  <TransactionRow key={t.id} transaction={t} showDate />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`Ngân sách chi tiêu tháng ${month}`}
            description="Thực tế so với dự kiến của từng nhóm"
            action={
              <Link
                href={`/budget?year=${year}&month=${month}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand-ink hover:underline"
              >
                Lập ngân sách
              </Link>
            }
          />
          <CardBody className="space-y-5">
            {SPENDING_CATEGORIES.map((c) => (
              <BudgetMeter
                key={c}
                label={CATEGORY_META[c].label}
                color={CATEGORY_META[c].color}
                actual={snapshot.spendingByCategory[c].actual}
                planned={snapshot.spendingByCategory[c].planned}
              />
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutChart
          title={`Cơ cấu chi tiêu tháng ${month}`}
          description="Theo nhóm, không gồm tiết kiệm/đầu tư"
          centerLabel="Chi tiêu"
          slices={SPENDING_CATEGORIES.map((c) => ({
            key: c,
            label: CATEGORY_META[c].label,
            value: snapshot.spendingByCategory[c].actual,
            color: CATEGORY_META[c].color,
          }))}
        />
        <Card>
          <CardHeader title="Chi nhiều nhất" description={`Theo khoản mục, tháng ${month}/${year}`} />
          <CardBody>
            <RankedBars items={topItems} color={MEASURE_COLOR.spending} limit={6} emptyText="Tháng này chưa có khoản chi." />
          </CardBody>
        </Card>
      </div>

      <CashflowChart
        report={report}
        highlightMonth={month}
        title={`Thu – Chi – Thặng dư năm ${year}`}
        description="Tháng đang xem được tô nền"
      />
    </div>
  )
}
