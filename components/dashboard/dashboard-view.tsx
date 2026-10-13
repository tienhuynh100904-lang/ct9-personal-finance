'use client'

import { ArrowDownLeft, ArrowRight, ArrowUpRight, Inbox } from 'lucide-react'
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
import { StatTile } from '@/components/ui/stat-tile'
import { CATEGORY_META, MEASURE_COLOR } from '@/lib/categories'
import { openComposer } from '@/lib/composer'
import {
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
import type { TransactionRecord } from '@/lib/types'

function progressText(actual: number, planned: number, noun: string) {
  if (planned <= 0) return `Chưa đặt ${noun}`
  return `${formatPercent(ratio(actual, planned), 0)} ${noun} ${formatVND(planned)}`
}

export function DashboardView({
  year,
  years,
  defaultMonth,
  transactions,
  budgetRows,
}: {
  year: number
  years: number[]
  defaultMonth: number
  transactions: TransactionRecord[]
  budgetRows: BudgetRow[]
}) {
  const [monthParam, setMonth] = useMonthParam(defaultMonth)
  const month = monthParam === 'all' ? defaultMonth : monthParam

  const report = useMemo(() => buildYearReport(transactions, year), [transactions, year])
  const plan = useMemo(() => buildBudgetPlan(budgetRows), [budgetRows])
  const snapshot = monthSnapshot(report, plan, month)
  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthOf(t.occurred_on) === month),
    [transactions, month],
  )
  const topItems = useMemo(() => topExpenseItems(transactions, year, { month }), [transactions, year, month])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher year={year} month={month} onMonthChange={setMonth} years={years} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openComposer({ kind: 'income' })}>
            <ArrowDownLeft className="size-4 text-income" aria-hidden />
            Thu nhập
          </Button>
          <Button onClick={() => openComposer({ kind: 'expense' })}>
            <ArrowUpRight className="size-4" aria-hidden />
            Chi tiêu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Thu nhập" value={formatVND(snapshot.income)} color={MEASURE_COLOR.income}>
          <p>{progressText(snapshot.income, snapshot.planned.income, 'dự kiến')}</p>
        </StatTile>
        <StatTile label="Chi tiêu" value={formatVND(snapshot.spending)} color={MEASURE_COLOR.spending}>
          <p>{progressText(snapshot.spending, snapshot.planned.spending, 'ngân sách')}</p>
        </StatTile>
        <StatTile label="Tiết kiệm/Đầu tư" value={formatVND(snapshot.saving)} color={MEASURE_COLOR.saving}>
          <p>{progressText(snapshot.saving, snapshot.planned.saving, 'mục tiêu')}</p>
          <p>Thực tế tiết kiệm: {formatPercent(snapshot.actualSavingRate)} thu nhập</p>
        </StatTile>
        <StatTile
          label="Thặng dư"
          value={snapshot.surplus < 0 ? formatSignedVND(snapshot.surplus) : formatVND(snapshot.surplus)}
          tone={snapshot.surplus < 0 ? 'negative' : 'default'}
        >
          <p>= Thu nhập − Chi tiêu − Tiết kiệm</p>
          <p>Có thể tiết kiệm: {formatPercent(snapshot.potentialSavingRate)} thu nhập</p>
        </StatTile>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Ngân sách chi tiêu tháng ${month}`}
            description="Thực tế so với dự kiến của từng nhóm"
            action={
              <Link href={`/ngan-sach?nam=${year}&thang=${month}`} className="text-sm font-medium text-accent hover:underline">
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Chi nhiều nhất" description={`Theo khoản mục, tháng ${month}/${year}`} />
          <CardBody>
            <RankedBars items={topItems} color={MEASURE_COLOR.spending} limit={6} emptyText="Tháng này chưa có khoản chi." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Giao dịch gần đây"
            description={`${monthTransactions.length} giao dịch trong tháng`}
            action={
              <Link
                href={`/thu-chi?nam=${year}&thang=${month}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                Xem tất cả <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="px-2 pt-2 pb-3 sm:px-3">
            {monthTransactions.length === 0 ? (
              <EmptyState icon={Inbox} title="Chưa có giao dịch" action={<Button onClick={() => openComposer()}>Thêm giao dịch</Button>}>
                Ghi lại khoản thu, khoản chi đầu tiên của tháng {month}.
              </EmptyState>
            ) : (
              <ul>
                {monthTransactions.slice(0, 6).map((t) => (
                  <TransactionRow key={t.id} transaction={t} showDate />
                ))}
              </ul>
            )}
          </div>
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
