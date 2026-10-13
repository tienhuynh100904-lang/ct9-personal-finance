'use client'

import { useMemo, useState } from 'react'
import { YearSelect } from '@/components/app/period'
import { CashflowChart } from '@/components/charts/cashflow-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { MonthlyBars } from '@/components/charts/monthly-bars'
import { RankedBars } from '@/components/charts/ranked-bars'
import { SavingRateChart } from '@/components/charts/saving-rate-chart'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/choice'
import { Select } from '@/components/ui/field'
import { StatTile } from '@/components/ui/stat-tile'
import { CATEGORY_META, MEASURE_COLOR } from '@/lib/categories'
import {
  buildYearReport,
  INCOME_CATEGORIES,
  itemMonthly,
  SPENDING_CATEGORIES,
  sum,
  topExpenseItems,
} from '@/lib/finance'
import { formatPercent, formatSignedVND, formatVND } from '@/lib/format'
import type { TransactionRecord } from '@/lib/types'
import { MonthlyTable, type TableRow } from './monthly-table'

type Mode = 'amount' | 'share'

function ModeSwitch({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="w-44">
      <Segmented
        label="Hiển thị"
        value={value}
        onChange={onChange}
        options={[
          { value: 'amount', label: 'Số tiền' },
          { value: 'share', label: 'Tỷ trọng' },
        ]}
      />
    </div>
  )
}

export function AnalysisView({
  year,
  years,
  highlightMonth,
  transactions,
}: {
  year: number
  years: number[]
  highlightMonth?: number
  transactions: TransactionRecord[]
}) {
  const report = useMemo(() => buildYearReport(transactions, year), [transactions, year])
  const [includeSaving, setIncludeSaving] = useState(false)
  const [showAllItems, setShowAllItems] = useState(false)
  const topItems = useMemo(
    () => topExpenseItems(transactions, year, { includeSaving }),
    [transactions, year, includeSaving],
  )
  const allExpenseItems = useMemo(
    () => topExpenseItems(transactions, year, { includeSaving: true }).map((i) => i.item),
    [transactions, year],
  )
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const item = selectedItem && allExpenseItems.includes(selectedItem) ? selectedItem : (allExpenseItems[0] ?? null)
  const itemValues = useMemo(
    () => (item ? itemMonthly(transactions, year, 'expense', item) : null),
    [transactions, year, item],
  )
  const [incomeMode, setIncomeMode] = useState<Mode>('amount')
  const [spendingMode, setSpendingMode] = useState<Mode>('amount')
  const t = report.totals

  const incomeRows: TableRow[] =
    incomeMode === 'amount'
      ? [
          ...INCOME_CATEGORIES.map((c) => ({
            label: CATEGORY_META[c].label,
            values: report.income[c],
            total: t.incomeByCategory[c],
            format: 'money' as const,
          })),
          { label: 'Tổng cộng', values: report.incomeTotal, total: t.income, format: 'money', strong: true },
        ]
      : [
          ...INCOME_CATEGORIES.map((c) => ({
            label: CATEGORY_META[c].label,
            values: report.incomeShare[c],
            total: t.income ? t.incomeByCategory[c] / t.income : 0,
            format: 'percent' as const,
          })),
          {
            label: 'Tổng cộng',
            values: report.incomeTotal.map((v) => (v ? 1 : 0)),
            total: t.income ? 1 : 0,
            format: 'percent',
            strong: true,
          },
        ]

  const spendingRows: TableRow[] =
    spendingMode === 'amount'
      ? [
          ...SPENDING_CATEGORIES.map((c) => ({
            label: CATEGORY_META[c].label,
            dot: CATEGORY_META[c].color,
            values: report.spending[c],
            total: report.spendingAverage[c],
            format: 'money' as const,
          })),
          { label: 'Tổng cộng', values: report.spendingTotal, total: t.avgSpending, format: 'money', strong: true },
        ]
      : [
          ...SPENDING_CATEGORIES.map((c) => ({
            label: CATEGORY_META[c].label,
            dot: CATEGORY_META[c].color,
            values: report.spendingShare[c],
            total: t.spending ? t.spendingByCategory[c] / t.spending : 0,
            format: 'percent' as const,
          })),
          {
            label: 'Tổng cộng',
            values: report.spendingTotal.map((v) => (v ? 1 : 0)),
            total: t.spending ? 1 : 0,
            format: 'percent',
            strong: true,
          },
        ]

  const balanceRows: TableRow[] = [
    { label: 'Tiết kiệm/Đầu tư', dot: MEASURE_COLOR.saving, values: report.saving, total: t.saving, format: 'money' },
    { label: 'Thặng dư hàng tháng', values: report.surplus, total: t.surplus, format: 'money', strong: true, signed: 'good-up' },
    {
      label: 'Tỷ lệ có thể tiết kiệm',
      values: report.potentialSavingRate,
      total: t.income ? (t.income - t.spending) / t.income : 0,
      format: 'percent',
    },
    {
      label: 'Thực tế tiết kiệm',
      values: report.actualSavingRate,
      total: t.income ? t.saving / t.income : null,
      format: 'percent',
    },
  ]

  const itemTotal = itemValues ? sum(itemValues) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearSelect year={year} years={years} />
        <p className="text-sm text-muted">
          {report.activeMonths.length > 0
            ? `Có dữ liệu ${report.activeMonths.length}/12 tháng`
            : 'Năm này chưa có giao dịch'}
        </p>
      </div>

      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="mb-3 text-[15px] font-semibold tracking-tight">
          Tổng quan cả năm {year}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile size="sm" label="Tổng thu nhập năm" value={formatVND(t.income)} color={MEASURE_COLOR.income} />
          <StatTile size="sm" label="Tổng chi tiêu năm" value={formatVND(t.spending)} color={MEASURE_COLOR.spending} />
          <StatTile size="sm" label="Tổng tiết kiệm năm" value={formatVND(t.saving)} color={MEASURE_COLOR.saving} />
          <StatTile
            size="sm"
            label="Thặng dư năm"
            value={t.surplus < 0 ? formatSignedVND(t.surplus) : formatVND(t.surplus)}
            tone={t.surplus < 0 ? 'negative' : 'default'}
          />
          <StatTile size="sm" label="Thu nhập TB/tháng" value={formatVND(t.avgIncome)}>
            <p>Tổng năm ÷ 12 tháng</p>
          </StatTile>
          <StatTile size="sm" label="Chi tiêu TB/tháng" value={formatVND(t.avgSpending)}>
            <p>Tổng năm ÷ 12 tháng</p>
          </StatTile>
          <StatTile size="sm" label="Tích lũy" value={formatVND(t.accumulation)}>
            <p>Tiết kiệm + thặng dư</p>
          </StatTile>
          <StatTile size="sm" label="Tỷ lệ tích lũy / thu nhập" value={formatPercent(t.accumulationRate)} />
        </div>
      </section>

      <CashflowChart report={report} highlightMonth={highlightMonth} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutChart
          title="Cơ cấu chi tiêu cả năm"
          description="Theo nhóm, không gồm tiết kiệm/đầu tư"
          centerLabel="Chi tiêu năm"
          slices={SPENDING_CATEGORIES.map((c) => ({
            key: c,
            label: CATEGORY_META[c].label,
            value: t.spendingByCategory[c],
            color: CATEGORY_META[c].color,
          }))}
        />
        <SavingRateChart report={report} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top khoản chi cả năm"
            description="Xếp theo tổng số tiền của từng khoản mục"
            action={
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={includeSaving}
                  onChange={(e) => setIncludeSaving(e.target.checked)}
                  className="size-4 accent-[var(--ink)]"
                />
                Gồm tiết kiệm
              </label>
            }
          />
          <CardBody>
            <RankedBars items={topItems} color={MEASURE_COLOR.spending} limit={showAllItems ? undefined : 10} />
            {topItems.length > 10 ? (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAllItems((v) => !v)}>
                {showAllItems ? 'Thu gọn' : `Xem tất cả ${topItems.length} khoản mục`}
              </Button>
            ) : null}
          </CardBody>
        </Card>

        <MonthlyBars
          title="Chi tiết theo khoản mục"
          description={item ? `“${item}” qua từng tháng` : 'Chưa có khoản chi'}
          action={
            allExpenseItems.length > 0 ? (
              <div className="w-48">
                <Select
                  aria-label="Chọn khoản mục"
                  value={item ?? ''}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="h-9"
                >
                  {allExpenseItems.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null
          }
          series={[
            {
              key: 'item',
              label: item ?? 'Khoản mục',
              color: MEASURE_COLOR.spending,
              values: itemValues ?? Array.from({ length: 12 }, () => 0),
            },
          ]}
          footer={
            item ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <dt className="text-muted">Tổng cả năm</dt>
                  <dd className="font-semibold">{formatVND(itemTotal)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Trung bình / tháng</dt>
                  <dd className="font-semibold">{formatVND(itemTotal / 12)}</dd>
                </div>
              </dl>
            ) : null
          }
        />
      </div>

      <MonthlyTable
        title="Thu nhập theo khoản mục"
        description={incomeMode === 'amount' ? 'Đơn vị: đồng' : 'Tỷ trọng trong tổng thu nhập của tháng'}
        rows={incomeRows}
        highlightMonth={highlightMonth}
        action={<ModeSwitch value={incomeMode} onChange={setIncomeMode} />}
      />
      <MonthlyTable
        title="Chi tiêu theo khoản mục"
        description={
          spendingMode === 'amount'
            ? 'Đơn vị: đồng · cột cuối là trung bình 12 tháng'
            : 'Tỷ trọng trong tổng chi tiêu của tháng (không gồm tiết kiệm)'
        }
        totalLabel={spendingMode === 'amount' ? 'TB/tháng' : 'Cả năm'}
        rows={spendingRows}
        highlightMonth={highlightMonth}
        action={<ModeSwitch value={spendingMode} onChange={setSpendingMode} />}
      />
      <MonthlyTable
        title="Tiết kiệm & thặng dư"
        description="Thặng dư = thu nhập − chi tiêu − tiết kiệm/đầu tư"
        rows={balanceRows}
        highlightMonth={highlightMonth}
      />
    </div>
  )
}
