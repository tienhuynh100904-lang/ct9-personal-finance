'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { YearReport } from '@/lib/finance'
import { formatPercent, MONTH_LABELS, MONTH_SHORT } from '@/lib/format'
import { AXIS_STROKE, AXIS_TICK, ChartCard, ChartFrame, GRID_STROKE, tooltipRenderer, type LegendEntry } from './chart-kit'

const LEGEND: LegendEntry[] = [
  { label: 'Tỷ lệ có thể tiết kiệm', color: 'var(--c-rate-bar)', shape: 'bar' },
  { label: 'Thực tế tiết kiệm', color: 'var(--c-rate-line)', shape: 'line' },
]

const renderTooltip = tooltipRenderer(
  (v) => formatPercent(v),
  (label) => MONTH_LABELS[MONTH_SHORT.indexOf(label)] ?? label,
)

/** Both series are percentages of income, so they share one axis. */
export function SavingRateChart({ report, height = 260 }: { report: YearReport; height?: number }) {
  const data = MONTH_SHORT.map((month, i) => ({
    month,
    potential: report.potentialSavingRate[i],
    actual: report.actualSavingRate[i],
  }))

  return (
    <ChartCard
      title="Tỷ lệ tiết kiệm theo tháng"
      description="Có thể tiết kiệm = (thu − chi) / thu · Thực tế = tiết kiệm / thu"
      legend={LEGEND}
      table={{
        columns: ['Tháng', 'Có thể tiết kiệm', 'Thực tế tiết kiệm'],
        rows: data.map((d, i) => ({
          label: MONTH_LABELS[i],
          values: [formatPercent(d.potential), formatPercent(d.actual)],
        })),
      }}
    >
      <ChartFrame height={height} label={`Tỷ lệ tiết kiệm theo tháng năm ${report.year}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height }}>
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: AXIS_STROKE }} tick={AXIS_TICK} interval={0} />
            <YAxis
              tickFormatter={(v: number) => formatPercent(v, 0)}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={46}
              domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(1, max)]}
            />
            <ReferenceLine y={0} stroke={AXIS_STROKE} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--surface-2)', fillOpacity: 0.7 }} />
            <Bar dataKey="potential" name="Có thể tiết kiệm" fill="var(--c-rate-bar)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Line
              dataKey="actual"
              name="Thực tế tiết kiệm"
              type="linear"
              stroke="var(--c-rate-line)"
              strokeWidth={2}
              connectNulls={false}
              dot={{ r: 4, fill: 'var(--c-rate-line)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--c-rate-line)', stroke: 'var(--surface)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ChartCard>
  )
}
