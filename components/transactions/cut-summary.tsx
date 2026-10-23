import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import type { CutBudget, CutSummary } from '@/lib/finance'
import { formatPercent, formatSignedVND, formatVND } from '@/lib/format'

const MAX_ITEMS = 5

/**
 * "Nếu bỏ các khoản muốn giảm": the period's spending as it is, and without the expenses marked
 * "Muốn giảm". It always shows the full comparison while reviewing (with nothing marked both columns are equal). It compares the same period with and without those expenses, so the saving is exact
 * for what already happened (it does not predict next month).
 */
export function CutSummaryCard({ summary, budget, periodLabel }: { summary: CutSummary; budget: CutBudget | null; periodLabel: string }) {
  const { count, amount } = summary
  const rows = [
    { label: 'Chi tiêu', planned: budget?.spending ?? 0, before: summary.spendingBefore, after: summary.spendingAfter, strong: true },
    ...summary.byCategory
      .map((c) => ({
        label: CATEGORY_META[c.category].label,
        planned: budget?.byCategory[c.category] ?? 0,
        before: c.before,
        after: c.after,
        color: CATEGORY_META[c.category].color,
        strong: false,
      }))
      .filter((row) => row.before > 0 || row.planned > 0),
    { label: 'Còn lại', planned: budget?.balance ?? 0, before: summary.balanceBefore, after: summary.balanceAfter, strong: true },
  ]

  return (
    <Card>
      <CardHeader title="Nếu bỏ các khoản muốn giảm" description={periodLabel} />
      <CardBody className="space-y-4 pt-3 sm:pt-3">
        <div>
          <p className="text-xs text-muted">Giảm được</p>
          <p className={cn('text-2xl font-semibold tracking-tight tabular-nums', count > 0 && 'text-positive')}>{formatVND(amount)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {count > 0 ? `${count} khoản · ${formatPercent(summary.share, 0)} tổng chi tiêu` : 'Chưa chọn khoản nào. Tích ô bên phải các khoản chi bạn muốn giảm.'}
          </p>
        </div>

        <table className="w-full text-sm">
          <caption className="sr-only">So sánh chi tiêu hiện tại và nếu bỏ các khoản muốn giảm</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="pb-1.5 text-left font-medium" />
              {budget ? (
                // Phones keep to the two columns: the plan is a desktop comparison.
                <th scope="col" className="hidden pb-1.5 text-right font-medium sm:table-cell">
                  Ngân sách
                </th>
              ) : null}
              <th scope="col" className="pb-1.5 text-right font-medium">
                Hiện tại
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                Nếu bỏ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const changed = row.after !== row.before
              return (
                <tr key={row.label}>
                  <th scope="row" className={cn('py-2 pr-2 text-left', row.strong ? 'font-semibold' : 'font-normal text-ink-2')}>
                    <span className="inline-flex items-center gap-1.5">
                      {'color' in row && row.color ? <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: row.color }} /> : null}
                      {row.label}
                    </span>
                  </th>
                  {budget ? (
                    <td className="hidden py-2 text-right tabular-nums text-muted sm:table-cell">{row.planned < 0 ? formatSignedVND(row.planned) : formatVND(row.planned)}</td>
                  ) : null}
                  <td className="py-2 text-right tabular-nums text-ink-2">{row.before < 0 ? formatSignedVND(row.before) : formatVND(row.before)}</td>
                  <td className={cn('py-2 text-right tabular-nums', row.strong ? 'font-semibold' : 'font-medium', changed && 'text-positive')}>
                    {row.after < 0 ? formatSignedVND(row.after) : formatVND(row.after)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {count > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Khoản mục muốn giảm</p>
            <ul className="divide-y divide-line">
              {summary.items.slice(0, MAX_ITEMS).map((entry) => (
                <li key={entry.item} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {entry.item} <span className="text-xs text-muted">· {entry.count} lần</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-2">{formatVND(entry.amount)}</span>
                </li>
              ))}
            </ul>
            {summary.items.length > MAX_ITEMS ? <p className="pt-1 text-xs text-muted">và {summary.items.length - MAX_ITEMS} khoản mục khác</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
