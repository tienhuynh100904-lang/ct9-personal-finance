'use client'

import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Monthly } from '@/lib/finance'
import { formatCompact, formatVND, MONTH_LABELS, MONTH_SHORT } from '@/lib/format'
import { AXIS_STROKE, AXIS_TICK, ChartCard, ChartFrame, GRID_STROKE, tooltipRenderer, type LegendEntry } from './chart-kit'

const monthTitle = (label: string) => MONTH_LABELS[MONTH_SHORT.indexOf(label)] ?? label
const renderTooltip = tooltipRenderer(formatVND, monthTitle)

export type MonthlySeries = { key: string; label: string; color: string; values: Monthly }

/** Columns per month for one or two series — single-series item detail, or planned vs actual. */
export function MonthlyBars({
  title,
  description,
  series,
  action,
  footer,
  height = 240,
}: {
  title: string
  description?: ReactNode
  series: MonthlySeries[]
  action?: ReactNode
  footer?: ReactNode
  height?: number
}) {
  const data = MONTH_SHORT.map((month, i) => ({
    month,
    ...Object.fromEntries(series.map((s) => [s.key, s.values[i]])),
  }))
  const legend: LegendEntry[] = series.map((s) => ({ label: s.label, color: s.color, shape: 'bar' }))

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      legend={legend}
      table={{
        columns: ['Tháng', ...series.map((s) => s.label)],
        rows: MONTH_LABELS.map((label, i) => ({ label, values: series.map((s) => formatVND(s.values[i])) })),
      }}
    >
      <ChartFrame height={height} label={title}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height }}>
          <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: AXIS_STROKE }} tick={AXIS_TICK} interval={0} />
            <YAxis tickFormatter={formatCompact} tickLine={false} axisLine={false} tick={AXIS_TICK} width={46} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--surface-2)', fillOpacity: 0.7 }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      {footer}
    </ChartCard>
  )
}
