'use client'

import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CircleAlert, Leaf, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { markNoSpend, unmarkNoSpend } from '@/lib/actions/day-marks'
import { openComposer, type ComposerRequest } from '@/lib/composer'
import { todayISO } from '@/lib/dates'
import type { Kind } from '@/lib/finance'
import { formatDayLabel, formatDayMonth, formatVND } from '@/lib/format'
import {
  addDays,
  buildDayLog,
  dailyAllowance,
  greeting,
  loggingStreak,
  monthCoverage,
  recentGap,
  weekCells,
} from '@/lib/habit'
import type { HabitData } from '@/lib/types'
import { useLocalValue, writeLocalValue } from '@/lib/use-local-value'
import { DaySheet } from './day-sheet'
import { WeekStrip } from './week-strip'

const NUDGE_KEY = 'ct9-nudge-dismissed'

/**
 * The daily cue: how much can still be spent today, whether today is logged, the
 * last 7 days and a gentle nudge to fill gaps. Always about *today* (not the month
 * being viewed below). Copy never blames: an empty day is "chưa có ghi chép".
 */
export function TodayCard({ habit }: { habit: HabitData }) {
  const router = useRouter()
  const { today, windowStart, hour, transactions, monthBudget, noSpendDays, marksAvailable, hasAnyTransaction } = habit

  const log = useMemo(() => buildDayLog(transactions, noSpendDays), [transactions, noSpendDays])
  const streak = useMemo(() => loggingStreak(log, today, windowStart), [log, today, windowStart])
  const gap = useMemo(() => recentGap(log, today, windowStart), [log, today, windowStart])
  const coverage = useMemo(() => monthCoverage(log, today), [log, today])
  const cells = useMemo(() => weekCells(log, today), [log, today])
  const allowance = useMemo(() => dailyAllowance({ txns: transactions, monthBudget, today }), [transactions, monthBudget, today])

  const [day, setDay] = useState<string | null>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const [pending, startTransition] = useTransition()
  const nudgeDismissed = useLocalValue(NUDGE_KEY)

  // Celebrate the moment today first becomes logged (derived during render, so a hidden
  // route that is shown again never replays it).
  const [prevLogged, setPrevLogged] = useState(streak.todayLogged)
  const [celebrate, setCelebrate] = useState(false)
  if (prevLogged !== streak.todayLogged) {
    setPrevLogged(streak.todayLogged)
    if (streak.todayLogged) setCelebrate(true)
  }

  // After midnight (or when the app comes back to the foreground) the data is a day old.
  const lastRefreshAt = useRef(0)
  useEffect(() => {
    const check = () => {
      if (todayISO() !== today && Date.now() - lastRefreshAt.current > 30_000) {
        lastRefreshAt.current = Date.now()
        router.refresh()
      }
    }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('pageshow', check)
    const timer = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('pageshow', check)
      window.clearInterval(timer)
    }
  }, [today, router])

  const yesterday = addDays(today, -1)
  const todayEntry = log.get(today)
  const todayHasExpense = (todayEntry?.expenseCount ?? 0) > 0
  const canMarkToday = marksAvailable && !todayHasExpense && !todayEntry?.noSpend
  // `undefined` = not hydrated yet: wait, so a nudge dismissed earlier today never flashes in.
  const showNudge = hasAnyTransaction && gap.days >= 1 && gap.hasEarlierLog && nudgeDismissed !== undefined && nudgeDismissed !== today
  const monthNumber = Number(today.slice(5, 7))

  function closeDay(then?: () => void) {
    afterClose.current = then ?? null
    setDay(null)
  }

  /** Opens the entry sheet once the day sheet has finished closing (focus would otherwise be lost). */
  function composeFromDay(request: ComposerRequest) {
    closeDay(() => openComposer(request))
  }

  function runMark(target: string) {
    startTransition(async () => {
      const result = await runAction(() => markNoSpend(target))
      if (!result) return
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Đã đánh dấu không chi tiêu', {
        description: `Ngày ${formatDayMonth(target)} được tính vào chuỗi ghi chép.`,
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            void runAction(() => unmarkNoSpend(target)).then((undo) => {
              if (!undo) return
              if (undo.ok) toast.success('Đã bỏ đánh dấu', { description: `Ngày ${formatDayMonth(target)}.` })
              else toast.error(undo.error)
            })
          },
        },
      })
    })
  }

  function runUnmark(target: string) {
    startTransition(async () => {
      const result = await runAction(() => unmarkNoSpend(target))
      if (!result) return
      if (result.ok) toast.success('Đã bỏ đánh dấu', { description: `Ngày ${formatDayMonth(target)}.` })
      else toast.error(result.error)
    })
  }

  let caption: string
  if (streak.todayLogged && streak.current === 1 && !gap.hasEarlierLog) caption = 'Ngày đầu tiên, tốt lắm!'
  else if (streak.current > 0) caption = `Chuỗi ${streak.current}${streak.capped ? '+' : ''} ngày ghi chép${streak.todayLogged ? '' : ' · ghi hôm nay để nối dài'}`
  else if (streak.anyLogged) caption = 'Bắt đầu chuỗi mới hôm nay'
  else caption = 'Ghi khoản đầu tiên để bắt đầu'

  const prompt = !hasAnyTransaction
    ? 'Bắt đầu với khoản chi đầu tiên'
    : hour >= 19
      ? 'Tối rồi, hôm nay bạn đã chi những gì?'
      : 'Ghi ngay khi chi, chỉ mất vài giây.'

  const used = allowance.allowance > 0 ? Math.min(allowance.spentToday / allowance.allowance, 1) : 0

  return (
    <section
      aria-labelledby="today-title"
      className="rounded-3xl border border-line p-4 shadow-[var(--shadow-2)] [background:var(--hero-bg)] sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p id="today-title" className="text-sm font-medium text-ink-2">
            {greeting(hour)} · {formatDayLabel(today)}
          </p>
          {streak.current >= 2 ? (
            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-ink">
              <CalendarCheck className="icon-beat size-3.5" aria-hidden />
              {streak.current}
              {streak.capped ? '+' : ''} ngày liên tiếp
            </span>
          ) : null}
        </div>

        {allowance.status === 'ok' ? (
          <div className="mt-3">
            <p className="text-sm text-ink-2">Hôm nay còn được chi</p>
            <p className="mt-0.5 text-[34px] leading-[1.1] font-semibold tracking-tight tabular-nums sm:text-[40px]">
              {formatVND(allowance.remainingToday)}
            </p>
            <div
              role="meter"
              aria-label="Đã chi hôm nay so với mức gợi ý"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(used * 100)}
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
            >
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${used * 100}%`, background: 'var(--c-expense)' }} />
            </div>
            <p className="mt-2 text-sm text-ink-2">
              Đã chi hôm nay {formatVND(allowance.spentToday)} · {allowance.todayCount} khoản
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ngân sách tháng {monthNumber} còn {formatVND(allowance.monthRemaining)} cho {allowance.daysLeft} ngày
            </p>
          </div>
        ) : null}

        {allowance.status === 'over_today' ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <TriangleAlert className="icon-swing size-4 shrink-0 text-warning" aria-hidden />
              Hôm nay đã chi vượt mức gợi ý
            </p>
            <p className="mt-0.5 text-[34px] leading-[1.1] font-semibold tracking-tight tabular-nums sm:text-[40px]">
              {formatVND(allowance.overBy)}
            </p>
            <p className="mt-2 text-sm text-ink-2">Không sao, mức gợi ý những ngày tới sẽ tự điều chỉnh.</p>
            <p className="mt-0.5 text-xs text-muted">
              Đã chi hôm nay {formatVND(allowance.spentToday)} · {allowance.todayCount} khoản
            </p>
          </div>
        ) : null}

        {allowance.status === 'month_over' ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <CircleAlert className="icon-shake size-4 shrink-0 text-negative" aria-hidden />
              Ngân sách chi tiêu tháng {monthNumber} đã dùng hết
            </p>
            {allowance.overBy > 0 ? (
              <p className="mt-0.5 text-[34px] leading-[1.1] font-semibold tracking-tight text-negative tabular-nums sm:text-[40px]">
                Vượt {formatVND(allowance.overBy)}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-ink-2">Cứ ghi tiếp để thấy rõ khoản nào cần điều chỉnh.</p>
          </div>
        ) : null}

        {allowance.status === 'no_budget' ? (
          <div className="mt-3">
            <p className="text-sm text-ink-2">Hôm nay đã chi</p>
            <p className="mt-0.5 text-[34px] leading-[1.1] font-semibold tracking-tight tabular-nums sm:text-[40px]">
              {formatVND(allowance.spentToday)}
            </p>
            <Link
              href={`/budget?year=${today.slice(0, 4)}&month=${monthNumber}`}
              className="mt-2 inline-block text-sm font-medium text-brand-ink hover:underline"
            >
              Đặt ngân sách tháng để biết mỗi ngày còn chi được bao nhiêu →
            </Link>
          </div>
        ) : null}

        {streak.todayLogged ? null : (
          <div className="mt-4">
            <p className="text-[15px] font-semibold">{prompt}</p>
            {!hasAnyTransaction ? <p className="mt-0.5 text-sm text-ink-2">Dữ liệu càng đều, phân tích càng chính xác.</p> : null}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" compact onClick={() => openComposer({ kind: 'expense' })} className="min-w-0">
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            Ghi chi tiêu
          </Button>
          <Button size="lg" compact variant="secondary" onClick={() => openComposer({ kind: 'income' })} className="min-w-0">
            <ArrowDownLeft className="size-4 text-positive transition-transform duration-200 group-hover:translate-y-0.5 group-hover:-translate-x-0.5" aria-hidden />
            Ghi thu nhập
          </Button>
        </div>
        {canMarkToday ? (
          <Button variant="brand" disabled={pending} onClick={() => runMark(today)} className="mt-2 w-full">
            <Leaf className="icon-sway size-4" aria-hidden />
            Hôm nay không chi tiêu
          </Button>
        ) : null}
      </div>

      <div className="mt-5 min-w-0 lg:mt-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
          <p className="font-semibold text-ink">{caption}</p>
          {coverage.elapsed > 0 ? (
            <p className="text-muted">
              Tháng {monthNumber}: {coverage.logged}/{coverage.elapsed} ngày có ghi chép
            </p>
          ) : null}
        </div>
        <WeekStrip cells={cells} onSelect={setDay} celebrate={celebrate} onCelebrateEnd={() => setCelebrate(false)} />

        {showNudge ? (
          <div className="mt-4 rounded-2xl border border-line bg-surface/70 p-3 text-sm">
            <p>
              {gap.days === 1
                ? `Hôm qua (${formatDayLabel(yesterday)}) chưa có ghi chép.`
                : gap.days <= 3
                  ? `Có ${gap.days} ngày gần đây chưa có ghi chép.`
                  : 'Lâu rồi không gặp! Bắt đầu lại từ hôm nay là đủ, không cần ghi bù hết.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {gap.days <= 3 ? (
                <Button size="sm" onClick={() => openComposer({ kind: 'expense', date: yesterday })}>
                  Ghi bù hôm qua
                </Button>
              ) : null}
              {gap.days === 1 && marksAvailable ? (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => runMark(yesterday)}>
                  Hôm qua không chi tiêu
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => writeLocalValue(NUDGE_KEY, today)}>
                Để sau
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <DaySheet
        day={day}
        entry={day ? log.get(day) : undefined}
        transactions={day ? transactions.filter((t) => t.occurred_on === day) : []}
        marksAvailable={marksAvailable}
        busy={pending}
        onClose={() => {
          setDay(null)
          const next = afterClose.current
          afterClose.current = null
          next?.()
        }}
        onAdd={(kind: Kind) => composeFromDay({ kind, date: day ?? undefined })}
        onEdit={(t) =>
          composeFromDay({
            transaction: {
              id: t.id,
              kind: t.kind,
              item: t.item,
              category: t.category,
              amount: t.amount,
              occurred_on: t.occurred_on,
              note: t.note,
            },
          })
        }
        onMark={() => {
          const target = day
          if (target) closeDay(() => runMark(target))
        }}
        onUnmark={() => {
          const target = day
          if (target) closeDay(() => runUnmark(target))
        }}
      />
    </section>
  )
}
