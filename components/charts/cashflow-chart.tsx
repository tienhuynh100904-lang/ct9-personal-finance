'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MEASURE_COLOR } from '@/lib/categories'
import type { YearReport } from '@/lib/finance'
import { formatCompact, formatVND, MONTH_LABELS, MONTH_SHORT } from '@/lib/format'
import { AXIS_STROKE, AXIS_TICK, ChartCard, ChartFrame, GRID_STROKE, tooltipRenderer, type LegendEntry } from './chart-kit'

const LEGEND: LegendEntry[] = [
  { label: 'Thu nhập', color: MEASURE_COLOR.income, shape: 'bar' },
  { label: 'Chi tiêu', color: MEASURE_COLOR.spending, shape: 'bar' },
  { label: 'Tiết kiệm/Đầu tư', color: MEASURE_COLOR.saving, shape: 'bar' },
  { label: 'Thặng dư', color: MEASURE_COLOR.surplus, shape: 'line' },
]

const renderTooltip = tooltipRenderer(formatVND, (label) => MONTH_LABELS[MONTH_SHORT.indexOf(label)] ?? label)

/** "Thu – Chi – Thặng dư theo tháng": three bars per month plus the surplus line, one shared axis. */
export function CashflowChart({
  report,
  highlightMonth,
  title = 'Thu – Chi – Thặng dư theo tháng',
  description,
  height = 300,
}: {
  report: YearReport
  highlightMonth?: number
  title?: string
  description?: string
  height?: number
}) {
  const data = MONTH_SHORT.map((month, i) => ({
    month,
    income: report.incomeTotal[i],
    spending: report.spendingTotal[i],
    saving: report.saving[i],
    surplus: report.surplus[i],
  }))
  const highlighted = highlightMonth ? MONTH_SHORT[highlightMonth - 1] : null

  return (
    <ChartCard
      title={title}
      description={description}
      legend={LEGEND}
      table={{
        columns: ['Tháng', 'Thu nhập', 'Chi tiêu', 'Tiết kiệm', 'Thặng dư'],
        rows: data.map((d, i) => ({
          label: MONTH_LABELS[i],
          values: [d.income, d.spending, d.saving, d.surplus].map(formatVND),
        })),
      }}
    >
      <ChartFrame height={height} label={`${title} năm ${report.year}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <ComposedChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            {highlighted ? (
              <ReferenceArea x1={highlighted} x2={highlighted} fill="var(--surface-3)" fillOpacity={0.6} ifOverflow="extendDomain" />
            ) : null}
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: AXIS_STROKE }} tick={AXIS_TICK} interval={0} />
            <YAxis tickFormatter={formatCompact} tickLine={false} axisLine={false} tick={AXIS_TICK} width={46} />
            <ReferenceLine y={0} stroke={AXIS_STROKE} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--surface-2)', fillOpacity: 0.7 }} />
            <Bar dataKey="income" name="Thu nhập" fill={MEASURE_COLOR.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="spending" name="Chi tiêu" fill={MEASURE_COLOR.spending} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="saving" name="Tiết kiệm/Đầu tư" fill={MEASURE_COLOR.saving} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Line
              dataKey="surplus"
              name="Thặng dư"
              type="linear"
              stroke={MEASURE_COLOR.surplus}
              strokeWidth={2}
              dot={{ r: 4, fill: MEASURE_COLOR.surplus, stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: MEASURE_COLOR.surplus, stroke: 'var(--surface)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  )
}
