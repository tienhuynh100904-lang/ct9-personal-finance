'use client'

import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ratio } from '@/lib/finance'
import { formatCompact, formatPercent, formatVND } from '@/lib/format'
import { ChartCard, ChartFrame, tooltipRenderer } from './chart-kit'

export type DonutSlice = { key: string; label: string; value: number; color: string }

const renderTooltip = tooltipRenderer(formatVND, () => 'Cơ cấu')

/** Part-to-whole at a glance (≤ 6 slices), with a value + share list as direct labels. */
export function DonutChart({
  title,
  description,
  slices,
  centerLabel = 'Tổng',
  height = 200,
}: {
  title: string
  description?: string
  slices: DonutSlice[]
  centerLabel?: string
  height?: number
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const data = slices.filter((s) => s.value > 0).map((s) => ({ ...s, fill: s.color }))

  return (
    <ChartCard
      title={title}
      description={description}
      table={{
        columns: ['Phân loại', 'Số tiền', 'Tỷ trọng'],
        rows: slices.map((s) => ({ label: s.label, values: [formatVND(s.value), formatPercent(ratio(s.value, total))] })),
      }}
    >
      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,200px)_1fr]">
        <div className="relative mx-auto w-full max-w-[200px]">
          <ChartFrame height={height} label={`${title}: tổng ${formatVND(total)}`}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height }}>
              <PieChart>
                {total > 0 ? (
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="64%"
                    outerRadius="96%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ) : (
                  <Pie
                    data={[{ label: 'Chưa có dữ liệu', value: 1, fill: 'var(--surface-3)' }]}
                    dataKey="value"
                    innerRadius="64%"
                    outerRadius="96%"
                    stroke="none"
                    isAnimationActive={false}
                  />
                )}
                {total > 0 ? <Tooltip content={renderTooltip} /> : null}
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-muted">{centerLabel}</span>
            <span className="text-lg font-semibold tracking-tight">{formatCompact(total)}</span>
          </div>
        </div>
        <ul className="space-y-2.5">
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center gap-3 text-sm">
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="tabular-nums font-medium">{formatVND(slice.value)}</span>
              <span className="w-12 text-right tabular-nums text-muted">{formatPercent(ratio(slice.value, total), 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
