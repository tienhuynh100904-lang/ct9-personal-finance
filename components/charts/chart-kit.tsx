'use client'

import { ChartColumnBig, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { TooltipContentProps } from 'recharts'
import { Card, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/cn'

export const AXIS_TICK = { fill: 'var(--muted)', fontSize: 12 }
export const GRID_STROKE = 'var(--grid)'
export const AXIS_STROKE = 'var(--axis)'

export type SeriesShape = 'bar' | 'line'
export type LegendEntry = { label: string; color: string; shape: SeriesShape }

/** Legend mirrors the mark: a square for bars, a short stroke with a dot for lines. */
export function ChartLegend({ items, className }: { items: LegendEntry[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <SeriesKey color={item.color} shape={item.shape} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function SeriesKey({ color, shape }: { color: string; shape: SeriesShape }) {
  if (shape === 'line') {
    return (
      <svg width="16" height="10" aria-hidden className="shrink-0">
        <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="5" r="3" fill={color} />
      </svg>
    )
  }
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

type Formatter = (value: number) => string

/**
 * Tooltip body: values lead (strong), series names follow (secondary), each
 * keyed by a short stroke of the series color.
 */
export function tooltipRenderer(format: Formatter, title?: (label: string) => string) {
  function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null
    return (
      <div className="min-w-40 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-lg">
        <p className="mb-1.5 text-xs font-medium text-muted">{title ? title(String(label)) : String(label)}</p>
        <ul className="space-y-1">
          {payload.map((entry) => {
            const value = typeof entry.value === 'number' ? entry.value : null
            return (
              <li key={String(entry.dataKey)} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: entry.color }} />
                <span className="font-semibold tabular-nums">{value === null ? '—' : format(value)}</span>
                <span className="text-muted">{entry.name}</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
  return ChartTooltip
}

export type TableView = {
  columns: string[]
  rows: { label: string; values: string[] }[]
}

/** Card with a chart ⇄ table switch — every chart has an accessible table twin. */
export function ChartCard({
  title,
  description,
  legend,
  table,
  action,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  legend?: LegendEntry[]
  table?: TableView
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <>
            {action}
            {table ? (
              <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Cách hiển thị">
                {(
                  [
                    ['chart', 'Biểu đồ', ChartColumnBig],
                    ['table', 'Bảng', Table2],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={view === value}
                    onClick={() => setView(value)}
                    className={cn(
                      'grid size-8 place-items-center rounded-md transition-colors pointer-coarse:size-11',
                      view === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                    )}
                    title={label}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="sr-only">{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        }
      />
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        {view === 'table' && table ? (
          <DataTable table={table} />
        ) : (
          <>
            {legend && legend.length > 1 ? <ChartLegend items={legend} className="mb-3" /> : null}
            {children}
          </>
        )}
      </div>
    </Card>
  )
}

function DataTable({ table }: { table: TableView }) {
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {table.columns.map((column, i) => (
              <th key={column} scope="col" className={cn('py-2 font-medium', i > 0 && 'pl-4 text-right')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className="border-b border-line/60 last:border-0">
              <th scope="row" className="py-2 pr-2 text-left font-medium whitespace-nowrap">
                {row.label}
              </th>
              {row.values.map((value, i) => (
                <td key={i} className="py-2 pl-4 text-right whitespace-nowrap tabular-nums text-ink-2">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Reserves the chart's full height (plot + axis band) so nothing jumps while it measures. */
export function ChartFrame({ height, children, label }: { height: number; children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="w-full" style={{ height }}>
      {children}
    </div>
  )
}
