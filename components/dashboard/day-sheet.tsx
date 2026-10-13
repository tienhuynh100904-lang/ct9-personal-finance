'use client'

import { ArrowDownLeft, ArrowUpRight, Leaf } from 'lucide-react'
import { TransactionRow } from '@/components/transactions/transaction-row'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import type { Kind } from '@/lib/finance'
import { formatDayLabel, formatVND } from '@/lib/format'
import type { DayLog } from '@/lib/habit'
import type { TransactionRecord } from '@/lib/types'

/**
 * One day of the habit window: what was logged, plus the ways to fill it in. Anything
 * that opens another dialog or shows a toast first closes this one (a toast would be
 * hidden behind the modal) — the caller defers the follow-up until the close completes.
 */
export function DaySheet({
  day,
  entry,
  transactions,
  marksAvailable,
  busy,
  onClose,
  onAdd,
  onEdit,
  onMark,
  onUnmark,
}: {
  day: string | null
  entry: DayLog | undefined
  transactions: TransactionRecord[]
  marksAvailable: boolean
  busy: boolean
  onClose: () => void
  onAdd: (kind: Kind) => void
  onEdit: (transaction: TransactionRecord) => void
  onMark: () => void
  onUnmark: () => void
}) {
  const hasExpense = (entry?.expenseCount ?? 0) > 0
  const marked = Boolean(entry?.noSpend) && !hasExpense
  const parts: string[] = []
  if (entry && entry.count > 0) {
    parts.push(`Đã ghi ${entry.count} khoản`)
    if (entry.spending > 0) parts.push(`Chi ${formatVND(entry.spending)}`)
    if (entry.income > 0) parts.push(`Thu ${formatVND(entry.income)}`)
  }
  const description = parts.length > 0 ? parts.join(' · ') : marked ? 'Đã đánh dấu không chi tiêu' : 'Chưa có ghi chép'

  return (
    <Dialog open={day !== null} onClose={onClose} title={day ? formatDayLabel(day) : ''} description={description}>
      <DialogBody>
        {transactions.length > 0 ? (
          <ul className="-mx-2">
            {transactions.map((t) => (
              <TransactionRow key={t.id} transaction={t} onSelect={onEdit} />
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            {marked ? 'Ngày này bạn không chi tiêu gì.' : 'Chưa có khoản nào trong ngày này.'}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <div className="grid grid-cols-2 gap-2">
          <Button compact onClick={() => onAdd('expense')} className="min-w-0">
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            Thêm khoản chi
          </Button>
          <Button compact variant="secondary" onClick={() => onAdd('income')} className="min-w-0">
            <ArrowDownLeft className="size-4 text-positive transition-transform duration-200 group-hover:translate-y-0.5 group-hover:-translate-x-0.5" aria-hidden />
            Thêm khoản thu
          </Button>
        </div>
        {marksAvailable && marked ? (
          <Button variant="brand" onClick={onUnmark} disabled={busy} className="mt-2 w-full">
            <Leaf className="icon-hover-wiggle size-4" aria-hidden />
            Bỏ đánh dấu không chi tiêu
          </Button>
        ) : null}
        {marksAvailable && !marked && !hasExpense ? (
          <Button variant="brand" onClick={onMark} disabled={busy} className="mt-2 w-full">
            <Leaf className="icon-hover-wiggle size-4" aria-hidden />
            Ngày này không chi tiêu
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  )
}
