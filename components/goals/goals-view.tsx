'use client'

import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, CircleAlert, CircleCheck, PiggyBank, Plus, ShieldCheck, Sparkles, Target, Trash2, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatTile } from '@/components/ui/stat-tile'
import { deleteGoal } from '@/lib/actions/goals'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import type { GoalsData } from '@/lib/data'
import { formatDate, formatPercent, formatVND } from '@/lib/format'
import { runAction } from '@/lib/run-action'
import { afterDialogClose, toast } from '@/lib/toast'
import {
  EMERGENCY_BENCHMARKS,
  feasibility,
  GOAL_PLACES,
  goalProgress,
  unallocated,
  type GoalKind,
  type GoalPace,
  type GoalProgress,
  type GoalRecord,
} from '@/lib/goals'
import { AllocateDialog, GoalDetailDialog, GoalFormDialog, TakeOutDialog } from './goal-dialogs'

const IDEAS = ['Đi du lịch', 'Mua xe', 'Học phí', 'Mua nhà', 'Đám cưới', 'Nghỉ hưu']

const PACE: Record<GoalPace, { label: string; className: string }> = {
  done: { label: 'Đã đạt', className: 'bg-[color-mix(in_oklab,var(--s-good)_16%,var(--surface))] text-positive' },
  on_track: { label: 'Đúng tiến độ', className: 'bg-[color-mix(in_oklab,var(--s-good)_12%,var(--surface))] text-positive' },
  behind: { label: 'Chậm tiến độ', className: 'bg-[color-mix(in_oklab,var(--s-warning)_22%,var(--surface))] text-warning' },
  overdue: { label: 'Quá hạn', className: 'bg-[color-mix(in_oklab,var(--s-critical)_14%,var(--surface))] text-negative' },
  not_started: { label: 'Chưa bắt đầu', className: 'bg-surface-2 text-muted' },
}

type FormState = { open: boolean; kind: GoalKind; goal: GoalRecord | null; presetName?: string }

/** What a goal asks you to save each month from now on (nothing once reached or before it starts). */
function monthlyNeed(p: GoalProgress | null): number {
  return !p || p.fromNow.done || p.pace === 'not_started' ? 0 : p.fromNow.amount
}

/**
 * "Mục tiêu": the savings pool (all "Tiết kiệm/Đầu tư" entries not yet in a goal), the emergency
 * fund that every account has, and any number of custom goals. Money is moved from the pool into
 * goals (one or several at once) and back out; nothing here creates transactions.
 */
export function GoalsView({ data }: { data: GoalsData }) {
  const { goals, allocations, pool, monthlySaving, essentialAverage, today } = data
  const progresses = useMemo(() => goals.map((g) => goalProgress(g, allocations, today)), [goals, allocations, today])

  const emergency = progresses.find((p) => p.goal.kind === 'emergency') ?? null
  const custom = progresses.filter((p) => p.goal.kind === 'custom' && !p.goal.archived_at)
  const archived = progresses.filter((p) => p.goal.archived_at)
  const active = [...(emergency ? [emergency] : []), ...custom]

  const available = unallocated(pool)
  const accumulated = active.reduce((sum, p) => sum + p.accrual.balance, 0)
  const interest = active.reduce((sum, p) => sum + p.accrual.interest, 0)
  const requiredMonthly = active.reduce((sum, p) => sum + monthlyNeed(p), 0)
  const doneCount = progresses.filter((p) => p.pace === 'done' || p.goal.archived_at).length
  const verdict = feasibility(requiredMonthly, monthlySaving)
  const [year, month] = today.split('-').map(Number)

  const [form, setForm] = useState<FormState>({ open: false, kind: 'custom', goal: null })
  // What the other goals need each month: the goal being edited is replaced by the live preview.
  const editedNeed = form.goal ? monthlyNeed(active.find((p) => p.goal.id === form.goal?.id) ?? null) : 0
  const otherMonthly = Math.max(0, requiredMonthly - editedNeed)
  const [allocateFor, setAllocateFor] = useState<string | null | undefined>(undefined)
  const [withdrawFrom, setWithdrawFrom] = useState<GoalProgress | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = progresses.find((p) => p.goal.id === detailId) ?? null

  const [deleting, setDeleting] = useState<GoalProgress | null>(null)
  const [deletePending, startDelete] = useTransition()

  const openCreate = (presetName?: string) => setForm({ open: true, kind: 'custom', goal: null, presetName })
  const openEdit = (goal: GoalRecord) => setForm({ open: true, kind: goal.kind, goal })

  function confirmDelete() {
    const target = deleting
    if (!target || deletePending) return
    startDelete(async () => {
      const result = await runAction(() => deleteGoal(target.goal.id))
      // On a failure the confirmation stays open and the error is shown inside it; closing first
      // would take the toast down with the dialog.
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      setDeleting(null)
      afterDialogClose(() =>
        toast.success(`Đã xoá “${target.goal.name}”`, {
          description: target.allocated > 0 ? `${formatVND(target.allocated)} đã quay về tiền chưa phân bổ.` : undefined,
        }),
      )
    })
  }

  // The dialogs live outside the `space-y-4` stack: that utility would also set the margins of a
  // <dialog> child and pin it to the top of the screen.
  return (
    <>
      <div className="space-y-4">
      {/* The pool: what has been saved and is still free to put into goals. */}
      <section
        aria-labelledby="pool-title"
        className="rounded-3xl border border-line p-4 shadow-[var(--shadow-2)] [background:var(--hero-bg)] sm:p-6 lg:flex lg:items-end lg:justify-between lg:gap-8"
      >
        <div className="min-w-0">
          <p id="pool-title" className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <PiggyBank className="icon-float size-4 text-brand-ink" aria-hidden />
            Tiền tiết kiệm chưa phân bổ
          </p>
          <p className={cn('mt-1 text-[34px] leading-[1.1] font-semibold tracking-tight tabular-nums sm:text-[40px]', available < 0 && 'text-negative')}>
            {formatVND(available)}
          </p>
          <p className="mt-2 text-sm text-ink-2">
            Đã tiết kiệm {formatVND(pool.saved)} · đang trong quỹ {formatVND(pool.allocated)}
            {pool.spent > 0 ? ` · đã chi từ quỹ ${formatVND(pool.spent)}` : ''}
          </p>
          {available < 0 ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-negative">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Số đã chia vào quỹ lớn hơn tiền tiết kiệm đã ghi (có thể do xoá giao dịch). Hãy rút bớt khỏi quỹ.
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0">
          {available > 0 && active.length > 0 ? (
            <Button size="lg" onClick={() => setAllocateFor(null)}>
              <ArrowDownToLine className="size-4" aria-hidden />
              Phân bổ vào quỹ
            </Button>
          ) : (
            <Button size="lg" onClick={() => openComposer({ kind: 'expense' })}>
              <Plus className="size-4" aria-hidden />
              Ghi khoản tiết kiệm
            </Button>
          )}
          {available > 0 && active.length === 0 ? <p className="w-full text-xs text-muted">Tạo một quỹ để bắt đầu phân bổ.</p> : null}
          {available <= 0 && pool.saved === 0 ? (
            <p className="w-full text-xs text-muted">Ghi khoản chi nhóm “Tiết kiệm/Đầu tư” (ví dụ gửi tiết kiệm) để có tiền phân bổ vào quỹ.</p>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Đã tích luỹ (các quỹ)" value={formatVND(accumulated)} color="var(--c-saving)">
          {interest > 0 ? <p>Gồm lãi tới nay +{formatVND(interest)}</p> : <p>{active.length} quỹ đang thực hiện</p>}
        </StatTile>
        <StatTile label="Cần tiết kiệm/tháng" value={formatVND(requiredMonthly)} color="var(--c-incidental)">
          <p>{monthlySaving > 0 ? `Ngân sách tiết kiệm ${formatVND(monthlySaving)}` : 'Chưa đặt ngân sách tiết kiệm'}</p>
        </StatTile>
        <StatTile label="Mục tiêu hoàn thành" value={`${doneCount}/${progresses.length}`}>
          <p>{archived.length > 0 ? `${archived.length} quỹ đã lưu trữ` : 'Tính cả quỹ đã lưu trữ'}</p>
        </StatTile>
        <StatTile label="Chưa phân bổ" value={formatVND(Math.max(0, available))}>
          <p>Từ các khoản Tiết kiệm/Đầu tư</p>
        </StatTile>
      </div>

      <FeasibilityBanner verdict={verdict} required={requiredMonthly} available={monthlySaving} year={year} month={month} />

      <EmergencyCard
        progress={emergency}
        essentialAverage={essentialAverage}
        onSetup={() => setForm({ open: true, kind: 'emergency', goal: emergency?.goal ?? null })}
        onAllocate={() => emergency && setAllocateFor(emergency.goal.id)}
        onWithdraw={() => emergency && setWithdrawFrom(emergency)}
        onDetail={() => emergency && setDetailId(emergency.goal.id)}
        onDelete={() => emergency && setDeleting(emergency)}
        canAllocate={available > 0}
      />

      <section aria-labelledby="goals-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="goals-title" className="text-[15px] font-semibold tracking-tight">
            Các quỹ mục tiêu
          </h2>
          <Button onClick={() => openCreate()}>
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
            Tạo quỹ mới
          </Button>
        </div>

        {custom.length === 0 ? (
          <Card className="flex flex-col items-center px-5 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
              <Target className="icon-float size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold">Bạn đang để dành cho điều gì?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Tạo một quỹ cho mỗi mục tiêu. App tính sẵn mỗi tháng cần tiết kiệm bao nhiêu để kịp hạn.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => openCreate(idea)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink pointer-coarse:h-10"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {idea}
                </button>
              ))}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {custom.map((p, i) => (
              <GoalCard
                key={p.goal.id}
                progress={p}
                index={i}
                canAllocate={available > 0}
                onAllocate={() => setAllocateFor(p.goal.id)}
                onWithdraw={() => setWithdrawFrom(p)}
                onDetail={() => setDetailId(p.goal.id)}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 ? (
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Đã lưu trữ ({archived.length})
            <ChevronDown className="size-4 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {archived.map((p) => (
              <li key={p.goal.id} className="flex items-center gap-1 pr-2">
                <button type="button" onClick={() => setDetailId(p.goal.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.goal.name}</span>
                    <span className="block text-xs text-muted">
                      {formatVND(p.accrual.balance)} / {formatVND(p.target)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </button>
                <DeleteButton name={p.goal.name} onClick={() => setDeleting(p)} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      </div>

      <GoalFormDialog
        open={form.open}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        kind={form.kind}
        goal={form.goal}
        presetName={form.presetName}
        essentialAverage={essentialAverage}
        monthlySaving={monthlySaving}
        otherMonthly={otherMonthly}
      />
      <AllocateDialog open={allocateFor !== undefined} onClose={() => setAllocateFor(undefined)} progresses={active} available={available} focusGoalId={allocateFor ?? null} />
      <TakeOutDialog progress={withdrawFrom} onClose={() => setWithdrawFrom(null)} />
      <GoalDetailDialog
        progress={detail}
        allocations={allocations}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onDelete={(p) => setDeleting(p)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Xoá “${deleting.goal.name}”?` : 'Xoá quỹ?'}
        description={
          deleting
            ? `${deleting.allocated > 0 ? `${formatVND(deleting.allocated)} đã phân bổ sẽ quay về tiền chưa phân bổ. ` : ''}Lịch sử nạp/rút của quỹ bị xoá theo. Các giao dịch tiết kiệm đã ghi không bị ảnh hưởng.`
            : undefined
        }
        confirmLabel={deletePending ? 'Đang xoá…' : 'Xoá quỹ'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function FeasibilityBanner({
  verdict,
  required,
  available,
  year,
  month,
}: {
  verdict: ReturnType<typeof feasibility>
  required: number
  available: number
  year: number
  month: number
}) {
  if (required <= 0) return null
  if (verdict === 'unknown') {
    return (
      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-ink-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
        <span>
          Đặt ngân sách <strong className="font-semibold text-ink">Tiết kiệm/Đầu tư</strong> tháng {month} để biết kế hoạch có khả thi không.{' '}
          <Link href={`/budget?year=${year}&month=${month}`} className="font-medium text-brand-ink hover:underline">
            Lập ngân sách →
          </Link>
        </span>
      </p>
    )
  }
  const tone =
    verdict === 'not_feasible'
      ? { Icon: TriangleAlert, motion: 'icon-swing', box: 'border-[color-mix(in_oklab,var(--s-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-warning)_9%,var(--surface))]', text: 'text-warning' }
      : { Icon: CircleCheck, motion: 'icon-pop', box: 'border-[color-mix(in_oklab,var(--s-good)_35%,transparent)] bg-[color-mix(in_oklab,var(--s-good)_7%,var(--surface))]', text: 'text-positive' }
  const message =
    verdict === 'not_feasible'
      ? 'Kế hoạch tiết kiệm chưa khả thi: cần giảm bớt mục tiêu, kéo dài thời hạn hoặc tăng ngân sách tiết kiệm.'
      : verdict === 'feasible'
        ? 'Kế hoạch tiết kiệm khả thi.'
        : 'Kế hoạch tiết kiệm rất khả thi, có thể cân nhắc tăng số tiền cho các mục tiêu.'
  return (
    <section className={cn('rise-in flex items-start gap-3 rounded-2xl border px-4 py-3', tone.box)}>
      <tone.Icon className={cn('mt-0.5 size-5 shrink-0', tone.text, tone.motion)} aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-ink">{message}</p>
        <p className="mt-0.5 text-ink-2">
          Các quỹ cần {formatVND(required)}/tháng · ngân sách tiết kiệm tháng {month} là {formatVND(available)} ({formatPercent(required / available, 0)}).
        </p>
      </div>
    </section>
  )
}

function ProgressBar({ progress, done }: { progress: GoalProgress; done: boolean }) {
  return (
    <div className="relative mt-3">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={`${progress.goal.name}: đạt ${formatPercent(progress.progress, 0)} mục tiêu`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.progress * 100)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]"
          style={{ width: `${progress.progress * 100}%`, background: done ? 'var(--s-good)' : 'var(--brand)' }}
        />
      </div>
      {/* The workbook's checkpoints at 25%, 50% and 75%. */}
      {[0.25, 0.5, 0.75].map((share) => (
        <span
          key={share}
          aria-hidden
          className={cn('absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded-full', progress.progress >= share ? 'bg-surface/80' : 'bg-line-strong')}
          style={{ left: `${share * 100}%` }}
        />
      ))}
    </div>
  )
}

function GoalCard({
  progress,
  index,
  canAllocate,
  onAllocate,
  onWithdraw,
  onDetail,
  onDelete,
}: {
  progress: GoalProgress
  index: number
  canAllocate: boolean
  onAllocate: () => void
  onWithdraw: () => void
  onDetail: () => void
  onDelete: () => void
}) {
  const { goal, pace, fromNow } = progress
  const done = pace === 'done'
  return (
    <Card className="rise-in p-4 sm:p-5" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', done ? 'bg-[color-mix(in_oklab,var(--s-good)_16%,var(--surface))] text-positive' : 'bg-brand-soft text-brand-ink')}>
          {done ? <CircleCheck className="icon-pop size-5" aria-hidden /> : <Target className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{goal.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            Hạn {formatDate(progress.deadline)} · {GOAL_PLACES[goal.place].label}
            {goal.rate_bp > 0 ? ` · ${String(goal.rate_bp / 100).replace('.', ',')}%/năm` : ''}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', PACE[pace].className)}>{PACE[pace].label}</span>
      </div>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatVND(progress.accrual.balance)}</span>
        <span className="text-sm text-muted tabular-nums">/ {formatVND(progress.target)}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">{formatPercent(progress.progress, 0)}</span>
      </p>
      <ProgressBar progress={progress} done={done} />

      <div className="mt-3 space-y-0.5 text-sm">
        {done ? (
          <p className="font-medium text-positive">Đã đạt mục tiêu. Có thể lưu trữ quỹ khi đã dùng xong.</p>
        ) : pace === 'not_started' ? (
          <p className="text-ink-2">Bắt đầu từ {formatDate(goal.start_date)}</p>
        ) : (
          <p className="text-ink-2">
            Cần gửi <strong className="font-semibold text-ink">{formatVND(fromNow.amount)}/tháng</strong>
            {fromNow.monthsLeft > 1 ? ` trong ${fromNow.monthsLeft} tháng còn lại` : ' để kịp hạn'}
          </p>
        )}
        <p className="text-xs text-muted">
          Kế hoạch ban đầu {formatVND(progress.planned)}/tháng
          {progress.accrual.interest > 0 ? ` · lãi tới nay +${formatVND(progress.accrual.interest)}` : ''}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1">
        {!done ? (
          <Button size="sm" onClick={onAllocate} disabled={!canAllocate} title={canAllocate ? undefined : 'Chưa có tiền tiết kiệm chưa phân bổ'}>
            <ArrowDownToLine className="size-3.5" aria-hidden />
            Nạp tiền
          </Button>
        ) : null}
        {progress.accrual.balance >= 1 ? (
          <Button size="sm" variant="ghost" onClick={onWithdraw} aria-label={`Rút hoặc chi tiền từ ${progress.goal.name}`}>
            <ArrowUpFromLine className="size-3.5 max-[380px]:hidden" aria-hidden />
            Rút / Chi
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDetail} className="ml-auto" aria-label={`Chi tiết ${progress.goal.name}`}>
          <span className="max-sm:sr-only">Chi tiết</span>
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
        <DeleteButton name={progress.goal.name} onClick={onDelete} />
      </div>
    </Card>
  )
}

function EmergencyCard({
  progress,
  essentialAverage,
  canAllocate,
  onSetup,
  onAllocate,
  onWithdraw,
  onDetail,
  onDelete,
}: {
  progress: GoalProgress | null
  essentialAverage: number | null
  canAllocate: boolean
  onSetup: () => void
  onAllocate: () => void
  onWithdraw: () => void
  onDetail: () => void
  onDelete: () => void
}) {
  if (!progress) {
    return (
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--c-saving)_14%,var(--surface))] text-saving">
          <ShieldCheck className="icon-swing size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Quỹ khẩn cấp</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Quỹ nên có đầu tiên: đủ trang trải 3–6 tháng chi phí cố định nếu mất thu nhập hoặc có việc gấp.
            {essentialAverage ? ` Chi tiêu thiết yếu của bạn khoảng ${formatVND(essentialAverage)}/tháng.` : ''}
          </p>
        </div>
        <Button size="lg" onClick={onSetup} className="sm:shrink-0">
          Thiết lập
        </Button>
      </Card>
    )
  }

  const { goal } = progress
  const monthly = goal.monthly_expense ?? 0
  const done = progress.pace === 'done'
  return (
    <Card className="rise-in overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--c-saving)_14%,var(--surface))] text-saving">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight">{goal.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {goal.reserve_months} tháng × {formatVND(monthly)} chi phí cố định · hạn {formatDate(progress.deadline)}
            </p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', PACE[progress.pace].className)}>{PACE[progress.pace].label}</span>
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatVND(progress.accrual.balance)}</span>
          <span className="text-sm text-muted tabular-nums">/ {formatVND(progress.target)}</span>
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatPercent(progress.progress, 0)}</span>
        </p>
        <ProgressBar progress={progress} done={done} />
        <p className="mt-3 text-sm text-ink-2">
          {done ? (
            <span className="font-medium text-positive">Quỹ khẩn cấp đã đủ. Tuyệt vời!</span>
          ) : (
            <>
              Cần gửi <strong className="font-semibold text-ink">{formatVND(progress.fromNow.amount)}/tháng</strong> để kịp hạn
            </>
          )}
        </p>
      </div>

      {/* The workbook's 1 / 3 / 6-month benchmarks. */}
      {monthly > 0 ? (
        <div className="grid grid-cols-3 border-t border-line bg-surface-2/50">
          {EMERGENCY_BENCHMARKS.map((m) => {
            const share = Math.min(1, progress.accrual.balance / (monthly * m))
            return (
              <div key={m} className="border-line px-3 py-3 text-center not-last:border-r sm:px-4">
                <p className="text-xs text-muted">{m} tháng</p>
                <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', share >= 1 && 'text-positive')}>
                  {share >= 1 ? <CircleCheck className="mr-1 inline size-3.5" aria-hidden /> : null}
                  {formatPercent(share, 0)}
                </p>
                <p className="text-[11px] text-muted tabular-nums">{formatVND(monthly * m)}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-t border-line px-4 py-3 sm:px-5">
        {!done ? (
          <Button size="sm" onClick={onAllocate} disabled={!canAllocate}>
            <ArrowDownToLine className="size-3.5" aria-hidden />
            Nạp tiền
          </Button>
        ) : null}
        {progress.accrual.balance >= 1 ? (
          <Button size="sm" variant="ghost" onClick={onWithdraw} aria-label={`Rút hoặc chi tiền từ ${progress.goal.name}`}>
            <ArrowUpFromLine className="size-3.5 max-[380px]:hidden" aria-hidden />
            Rút / Chi
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDetail} className="ml-auto" aria-label={`Chi tiết ${progress.goal.name}`}>
          <span className="max-sm:sr-only">Chi tiết</span>
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
        <DeleteButton name={progress.goal.name} onClick={onDelete} />
      </div>
    </Card>
  )
}

function DeleteButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="danger-ghost" onClick={onClick} aria-label={`Xoá ${name}`} title="Xoá quỹ">
      <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
    </Button>
  )
}
