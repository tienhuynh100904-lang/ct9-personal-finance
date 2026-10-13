import type { ReactNode } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { formatNumber, formatPercent, MONTH_SHORT } from '@/lib/format'

export type TableRow = {
  label: string
  values: (number | null)[]
  /** Value for the last column (year total, average…); omit to leave it blank. */
  total?: number | null
  format: 'money' | 'percent'
  dot?: string
  strong?: boolean
  /** Color the sign: `good-up` = positive is good (income), `good-down` = negative is good (spending). */
  signed?: 'good-up' | 'good-down'
}

const CELL = 'border-b border-line/60 px-3 py-2.5 text-right whitespace-nowrap tabular-nums'

function Cell({ value, row, highlight }: { value: number | null | undefined; row: TableRow; highlight?: boolean }) {
  const base = cn(CELL, highlight && 'bg-surface-2')
  if (value === undefined) return <td className={base} />
  if (value === null) return <td className={cn(base, 'text-muted')}>—</td>
  if (value === 0) return <td className={cn(base, 'text-muted/70')}>–</td>

  const text =
    row.format === 'percent'
      ? formatPercent(value)
      : `${value < 0 ? '−' : row.signed && value > 0 ? '+' : ''}${formatNumber(Math.abs(value))}`

  const good = row.signed === 'good-up' ? value > 0 : row.signed === 'good-down' ? value < 0 : null
  return (
    <td
      className={cn(
        base,
        good === true && 'text-positive',
        good === false && 'text-negative',
        good === null && value < 0 && 'text-negative',
      )}
    >
      {text}
    </td>
  )
}

/** A 12-month grid like the workbook's tables; first column sticks while scrolling sideways. */
export function MonthlyTable({
  title,
  description,
  rows,
  totalLabel = 'Cả năm',
  highlightMonth,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  rows: TableRow[]
  totalLabel?: string
  highlightMonth?: number
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      {children}
      <div className="scrollbar-thin mt-3 overflow-x-auto pb-1">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="sticky left-0 z-10 border-b border-line bg-surface py-2 pr-3 pl-4 text-left font-medium sm:pl-5">
                Khoản mục
              </th>
              {MONTH_SHORT.map((m, i) => (
                <th
                  key={m}
                  scope="col"
                  className={cn(
                    'border-b border-line px-3 py-2 text-right font-medium',
                    highlightMonth === i + 1 && 'bg-surface-2 text-ink',
                  )}
                >
                  {m}
                </th>
              ))}
              <th scope="col" className="border-b border-line py-2 pr-4 pl-3 text-right font-medium text-ink-2 sm:pr-5">
                {totalLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={cn(row.strong && 'font-semibold')}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 border-b border-line/60 bg-surface py-2.5 pr-3 pl-4 text-left whitespace-nowrap sm:pl-5',
                    row.strong ? 'font-semibold' : 'font-normal',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {row.dot ? <span aria-hidden className="size-2 rounded-full" style={{ background: row.dot }} /> : null}
                    {row.label}
                  </span>
                </th>
                {row.values.map((value, i) => (
                  <Cell key={i} value={value} row={row} highlight={highlightMonth === i + 1} />
                ))}
                <Cell value={row.total} row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
