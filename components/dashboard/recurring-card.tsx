'use client'

import { ArrowDownLeft, ArrowUpRight, Check, CheckCheck, LoaderCircle, Pencil, Repeat, SkipForward, Undo2, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { confirmRecurring, skipRecurring, unskipRecurring } from '@/lib/actions/recurring'
import { markNoSpend } from '@/lib/actions/day-marks'
import { deleteTransaction } from '@/lib/actions/transactions'
import { showBudgetAlert } from '@/lib/budget-alert-toast'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import type { RecurringData } from '@/lib/data'
import { formatDayMonth, formatSignedVND } from '@/lib/format'
import { confirmDate, recurringForMonth, type MonthlyRecurring } from '@/lib/recurring'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'
import { useLocalValue, writeLocalValue } from '@/lib/use-local-value'

const HINT_KEY = 'ct9-recurring-hint-dismissed'

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/**
 * This month's recurring entries (tiền nhà, điện nước, wifi, lương…), each one tap from being
 * logged. Nothing is created without a confirmation, because bills change from month to month.
 * Always about the current month, whatever month the dashboard is showing below.
 */
export function RecurringCard({ data }: { data: RecurringData }) {
  const { rules, runs, today } = data
  const month = useMemo(() => recurringForMonth(rules, runs, today), [rules, runs, today])
  const [year, monthNumber] = today.split('-').map(Number)
  const [pending, startTransition] = useTransition()
  const hintDismissed = useLocalValue(HINT_KEY)

  if (rules.length === 0) {
    if (hintDismissed !== null) return null
    return (
      <section className="rise-in flex items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-surface p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Repeat className="icon-float size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Tiền nhà, điện nước, wifi, lương… tháng nào cũng có?</p>
          <p className="mt-0.5 text-sm text-ink-2">Đặt một lần thành khoản định kỳ, mỗi tháng app gợi ý sẵn để bạn chỉ cần xác nhận.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings#recurring" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover">
              Thiết lập khoản định kỳ
            </Link>
            <Button variant="ghost" onClick={() => writeLocalValue(HINT_KEY, '1')}>
              Để sau
            </Button>
          </div>
        </div>
      </section>
    )
  }

  if (month.length === 0) return null

  const open = month.filter((m) => m.state === 'due' || m.state === 'upcoming')
  const due = month.filter((m) => m.state === 'due')
  const done = month.filter((m) => m.state === 'done')
  const skipped = month.filter((m) => m.state === 'skipped')

  function confirm(entry: MonthlyRecurring, amount?: number) {
    startTransition(async () => {
      await confirmOne(entry, amount)
    })
  }

  async function confirmOne(entry: MonthlyRecurring, amount?: number, quiet = false) {
    const result = await runAction(() => confirmRecurring({ id: entry.rule.id, year, month: monthNumber, amount }))
    if (!result) return false
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    const value = amount ?? entry.rule.amount
    const signed = formatSignedVND(entry.rule.kind === 'income' ? value : -value)
    const transactionId = result.transactionId
    if (!quiet) {
      toast.success(`Đã ghi “${entry.rule.item}”`, {
        description: signed,
        action: transactionId
          ? {
              label: 'Hoàn tác',
              onClick: () => {
                void (async () => {
                  const undo = await runAction(() => deleteTransaction(transactionId))
                  if (!undo) return
                  if (!undo.ok) return toast.error(undo.error)
                  if (result.clearedMark) await runAction(() => markNoSpend(confirmDate(entry.due, today)))
                  toast.success('Đã hoàn tác', { description: `“${entry.rule.item}” lại chờ xác nhận.` })
                })()
              },
            }
          : undefined,
      })
    }
    if (result.budgetAlert) showBudgetAlert(result.budgetAlert, confirmDate(entry.due, today))
    return true
  }

  function confirmAll() {
    startTransition(async () => {
      let count = 0
      for (const entry of due) if (await confirmOne(entry, undefined, true)) count += 1
      if (count > 0) toast.success(`Đã ghi ${count} khoản định kỳ`, { description: due.map((d) => d.rule.item).join(', ') })
    })
  }

  function skip(entry: MonthlyRecurring) {
    startTransition(async () => {
      const result = await runAction(() => skipRecurring({ id: entry.rule.id, year, month: monthNumber }))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      toast.success(`Đã bỏ qua “${entry.rule.item}” tháng ${monthNumber}`, {
        action: { label: 'Hoàn tác', onClick: () => void unskip(entry) },
      })
    })
  }

  async function unskip(entry: MonthlyRecurring) {
    const result = await runAction(() => unskipRecurring({ id: entry.rule.id, year, month: monthNumber }))
    if (result && !result.ok) toast.error(result.error)
  }

  if (open.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-1)]">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--s-good)_14%,var(--surface))] text-positive">
          <CheckCheck className="icon-pop size-4.5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Đã xong khoản định kỳ tháng {monthNumber}</span>
          <span className="text-muted">
            {' '}
            · {done.length} đã ghi{skipped.length ? `, ${skipped.length} bỏ qua` : ''}
          </span>
        </p>
        <Link href="/settings#recurring" className="shrink-0 text-sm font-medium text-brand-ink hover:underline">
          Quản lý
        </Link>
      </section>
    )
  }

  return (
    <Card aria-labelledby="recurring-title" className="rise-in overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
            <Repeat className="icon-swing size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="recurring-title" className="text-[15px] font-semibold tracking-tight">
              Khoản định kỳ tháng {monthNumber}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {due.length > 0 ? `${due.length} khoản đến hạn chờ xác nhận` : 'Chưa đến hạn khoản nào'} · {done.length}/{month.length} đã ghi
            </p>
          </div>
        </div>
        {due.length >= 2 ? (
          <Button size="sm" onClick={confirmAll} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
            Xác nhận tất cả ({due.length})
          </Button>
        ) : null}
      </div>

      <div className="mt-3 px-4 sm:px-5" aria-hidden>
        <div className="flex h-1.5 gap-1">
          {month.map((m) => (
            <span
              key={m.rule.id}
              className={cn(
                'flex-1 rounded-full transition-colors duration-500',
                m.state === 'done' ? 'bg-[var(--s-good)]' : m.state === 'skipped' ? 'bg-surface-3' : m.state === 'due' ? 'bg-brand' : 'bg-surface-3/70',
              )}
            />
          ))}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-line border-t border-line">
        {open.map((entry) => (
          <RecurringRow
            key={entry.rule.id}
            entry={entry}
            today={today}
            busy={pending}
            onConfirm={(amount) => confirm(entry, amount)}
            onSkip={() => skip(entry)}
          />
        ))}
      </ul>

      {done.length + skipped.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-3 text-xs sm:px-5">
          {done.map((m) => (
            <span key={m.rule.id} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-ink-2 ring-1 ring-line">
              <Check className="size-3.5 text-positive" strokeWidth={3} aria-hidden />
              {m.rule.item}
            </span>
          ))}
          {skipped.map((m) => (
            <button
              key={m.rule.id}
              type="button"
              onClick={() => startTransition(() => unskip(m))}
              disabled={pending}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-muted hover:text-ink"
              title="Bấm để hoàn tác bỏ qua"
            >
              <Undo2 className="size-3.5" aria-hidden />
              Bỏ qua: {m.rule.item}
            </button>
          ))}
          <Link href="/settings#recurring" className="ml-auto font-medium text-brand-ink hover:underline">
            Quản lý
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

function RecurringRow({
  entry,
  today,
  busy,
  onConfirm,
  onSkip,
}: {
  entry: MonthlyRecurring
  today: string
  busy: boolean
  onConfirm: (amount?: number) => void
  onSkip: () => void
}) {
  const { rule, due, state } = entry
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(rule.amount)
  const income = rule.kind === 'income'
  const KindIcon = income ? ArrowDownLeft : ArrowUpRight
  const isDue = state === 'due'
  const wait = daysBetween(today, due)

  return (
    <li className={cn('px-4 py-3 sm:px-5', isDue && 'bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface))]')}>
      <div className="flex items-center gap-3">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-surface-2', income ? 'text-positive' : 'text-expense')}>
          <KindIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{rule.item}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[rule.category].color }} />
              {CATEGORY_META[rule.category].label}
            </span>
            <span className={cn('whitespace-nowrap', isDue && 'font-medium text-brand-ink')}>
              {isDue ? (due === today ? 'Đến hạn hôm nay' : `Đến hạn ${formatDayMonth(due)}`) : `Ngày ${formatDayMonth(due)} · còn ${wait} ngày`}
            </span>
          </p>
        </div>
        <p className={cn('shrink-0 text-sm font-semibold tabular-nums', income ? 'text-positive' : 'text-ink')}>
          {formatSignedVND(income ? rule.amount : -rule.amount)}
        </p>
      </div>

      {editing ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 sm:pl-12"
          onSubmit={(e) => {
            e.preventDefault()
            if (amount > 0) onConfirm(amount)
          }}
        >
          <div className="min-w-48 flex-1">
            <AmountInput value={amount} onValueChange={setAmount} selectOnFocus autoFocus aria-label={`Số tiền ${rule.item} tháng này`} className="h-10" />
          </div>
          <Button type="submit" disabled={busy || amount <= 0}>
            <Check className="size-4" aria-hidden />
            Xác nhận
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Huỷ sửa số tiền">
            <X className="size-4" aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-12">
          <Button size="sm" variant={isDue ? 'primary' : 'secondary'} onClick={() => onConfirm()} disabled={busy}>
            <Check className="icon-hover-wiggle size-4" aria-hidden />
            {isDue ? 'Xác nhận' : 'Ghi sớm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
            <Pencil className="size-3.5" aria-hidden />
            Số tiền khác
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip} disabled={busy} className="text-muted" aria-label={`Bỏ qua ${rule.item} tháng này`}>
            <SkipForward className="size-3.5" aria-hidden />
            Bỏ qua
          </Button>
        </div>
      )}
    </li>
  )
}
