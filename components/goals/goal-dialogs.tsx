'use client'

import { Archive, ArchiveRestore, Check, CircleCheck, Info, LoaderCircle, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { markNoSpend } from '@/lib/actions/day-marks'
import { allocateSavings, deleteAllocation, saveGoal, setGoalArchived, spendFromGoal } from '@/lib/actions/goals'
import { deleteTransaction } from '@/lib/actions/transactions'
import { showBudgetAlert } from '@/lib/budget-alert-toast'
import { ItemPicker } from '@/components/transactions/item-picker'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/dates'
import type { SpendingCategory } from '@/lib/finance'
import { formatDate, formatPercent, formatSignedVND, formatVND } from '@/lib/format'
import { itemKey } from '@/lib/items'
import {
  addMonthsISO,
  emergencyTarget,
  feasibility,
  GOAL_PLACES,
  MAX_GOAL_RATE_BP,
  plannedMonthly,
  type AllocationRecord,
  type GoalKind,
  type GoalPlace,
  type GoalProgress,
  type GoalRecord,
} from '@/lib/goals'
import { runAction } from '@/lib/run-action'
import { afterDialogClose, toast } from '@/lib/toast'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import type { FieldErrors, GoalInput } from '@/lib/validation'

const MONTH_CHOICES = ['6', '12', '24', '36', '60']
const RESERVE_CHOICES = ['1', '3', '6', '9', '12']
const RATE_CHOICES = ['0', '4', '6', '8']

/** "4" or "4,5" (percent) → basis points; NaN when not a number. */
export function percentToBp(text: string): number {
  const value = Number(text.replace(',', '.').trim())
  return text.trim() === '' || !Number.isFinite(value) ? Number.NaN : Math.round(value * 100)
}

export function bpToPercent(bp: number): string {
  return String(bp / 100).replace('.', ',')
}

// ---- Create / edit --------------------------------------------------------------------

export function GoalFormDialog({
  open,
  onClose,
  kind,
  goal,
  presetName,
  essentialAverage,
  monthlySaving,
  otherMonthly,
}: {
  open: boolean
  onClose: () => void
  kind: GoalKind
  /** The goal being edited; `null` creates a new one. */
  goal: GoalRecord | null
  presetName?: string
  essentialAverage: number | null
  /** This month's "Tiết kiệm/Đầu tư" budget (0 = not set): what the goals can be funded from. */
  monthlySaving: number
  /** What the other active goals need each month, so the preview can show the whole plan. */
  otherMonthly: number
}) {
  const title = goal ? `Sửa ${goal.name}` : kind === 'emergency' ? 'Thiết lập Quỹ khẩn cấp' : 'Tạo quỹ mới'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={kind === 'emergency' ? 'Khoản dự phòng cho những tháng không có thu nhập hoặc chi phí bất ngờ.' : 'Đặt mục tiêu, hạn và nơi cất quỹ.'}
    >
      {open ? (
        <GoalForm
          key={`${goal?.id ?? 'new'}-${kind}-${presetName ?? ''}`}
          kind={kind}
          goal={goal}
          presetName={presetName}
          essentialAverage={essentialAverage}
          monthlySaving={monthlySaving}
          otherMonthly={otherMonthly}
          onDone={onClose}
        />
      ) : null}
    </Dialog>
  )
}

function GoalForm({
  kind,
  goal,
  presetName,
  essentialAverage,
  monthlySaving,
  otherMonthly,
  onDone,
}: {
  kind: GoalKind
  goal: GoalRecord | null
  presetName?: string
  essentialAverage: number | null
  monthlySaving: number
  otherMonthly: number
  onDone: () => void
}) {
  const emergency = kind === 'emergency'
  const [name, setName] = useState(goal?.name ?? (emergency ? 'Quỹ khẩn cấp' : (presetName ?? '')))
  const [target, setTarget] = useState(goal?.target_amount ?? 0)
  const [monthlyExpense, setMonthlyExpense] = useState(goal?.monthly_expense ?? essentialAverage ?? 0)
  const [reserveMonths, setReserveMonths] = useState(String(goal?.reserve_months ?? 6))
  const [startDate, setStartDate] = useState(goal?.start_date ?? todayISO())
  const [months, setMonths] = useState(String(goal?.months ?? 12))
  const [rate, setRate] = useState(goal ? bpToPercent(goal.rate_bp) : '0')
  const [place, setPlace] = useState<GoalPlace>(goal?.place ?? 'bank')
  const [initial, setInitial] = useState(goal?.initial_amount ?? 0)
  const [note, setNote] = useState(goal?.note ?? '')
  const [errors, setErrors] = useState<FieldErrors<GoalInput>>({})
  const [pending, startTransition] = useTransition()

  const monthsNumber = Number(months)
  const rateBp = percentToBp(rate)
  const effectiveTarget = emergency ? emergencyTarget(monthlyExpense, Number(reserveMonths)) : target
  const validMonths = Number.isInteger(monthsNumber) && monthsNumber >= 1 && monthsNumber <= 600
  const validRate = Number.isInteger(rateBp) && rateBp >= 0 && rateBp <= MAX_GOAL_RATE_BP
  const preview =
    effectiveTarget > 0 && validMonths && validRate
      ? { monthly: plannedMonthly({ target: effectiveTarget, months: monthsNumber, rateBp, existing: initial }), deadline: addMonthsISO(startDate, monthsNumber) }
      : null

  function submit() {
    const input: GoalInput = {
      id: goal?.id,
      kind,
      name,
      target_amount: emergency ? undefined : target,
      monthly_expense: emergency ? monthlyExpense : null,
      reserve_months: emergency ? Number(reserveMonths) : null,
      start_date: startDate,
      months: monthsNumber,
      rate_bp: rateBp,
      place,
      initial_amount: initial,
      note,
    }
    startTransition(async () => {
      const result = await runAction(() => saveGoal(input))
      if (!result) return
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      onDone()
      afterDialogClose(() =>
        toast.success(goal ? 'Đã lưu quỹ' : 'Đã tạo quỹ', { description: `“${name.trim()}” · mục tiêu ${formatVND(effectiveTarget)}` }),
      )
    })
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <DialogBody className="space-y-4">
        {emergency ? null : (
          <Field label="Tên quỹ" htmlFor="goal-name" error={errors.name}>
            <Input id="goal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Đi du lịch, Mua xe, Học phí…" maxLength={60} data-autofocus="" />
          </Field>
        )}

        {emergency ? (
          <>
            <Field
              label="Chi phí cố định 1 tháng"
              htmlFor="goal-monthly"
              error={errors.monthly_expense}
              hint="Tiền nhà, ăn uống, đi lại, hoá đơn… những khoản phải trả dù không có thu nhập."
            >
              <AmountInput id="goal-monthly" value={monthlyExpense} onValueChange={setMonthlyExpense} data-autofocus="" />
            </Field>
            {essentialAverage && essentialAverage !== monthlyExpense ? (
              <button type="button" onClick={() => setMonthlyExpense(essentialAverage)} className="-mt-2 text-left text-xs font-medium text-brand-ink hover:underline">
                Gợi ý: chi tiêu thiết yếu trung bình 3 tháng qua là {formatVND(essentialAverage)}. Dùng số này
              </button>
            ) : null}
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-2">Số tháng dự phòng</p>
              <ChoiceChips label="Số tháng dự phòng" value={reserveMonths} onChange={setReserveMonths} options={RESERVE_CHOICES.map((m) => ({ value: m, label: `${m} tháng` }))} />
              <p className="mt-1.5 text-xs text-muted">Thường nên có từ 3 đến 6 tháng chi phí.</p>
            </div>
          </>
        ) : (
          <Field label="Số tiền mục tiêu" htmlFor="goal-target" error={errors.target_amount}>
            <AmountInput id="goal-target" value={target} onValueChange={setTarget} />
          </Field>
        )}

        <Field label="Ngày bắt đầu" htmlFor="goal-start" error={errors.start_date}>
          <DatePicker id="goal-start" label="Ngày bắt đầu" value={startDate} onChange={setStartDate} invalid={Boolean(errors.start_date)} />
        </Field>
        <Field label="Số tháng thực hiện" htmlFor="goal-months" error={errors.months}>
          <Input id="goal-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Field>
        <ChoiceChips label="Chọn nhanh số tháng" value={MONTH_CHOICES.includes(months) ? months : null} onChange={setMonths} options={MONTH_CHOICES.map((m) => ({ value: m, label: `${m} tháng` }))} />

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Nơi cất quỹ</p>
          <ChoiceChips label="Nơi cất quỹ" value={place} onChange={setPlace} options={(Object.keys(GOAL_PLACES) as GoalPlace[]).map((p) => ({ value: p, label: GOAL_PLACES[p].label }))} />
          <p className="mt-1.5 text-xs text-muted">{GOAL_PLACES[place].hint}</p>
        </div>

        <Field
          label="Lợi nhuận kỳ vọng (%/năm)"
          htmlFor="goal-rate"
          error={errors.rate_bp ?? (rate.trim() !== '' && !validRate ? `Từ 0 đến ${MAX_GOAL_RATE_BP / 100}%. Cao hơn là không thực tế.` : undefined)}
          hint={`Tối đa ${MAX_GOAL_RATE_BP / 100}%/năm. Lãi tiết kiệm ngân hàng hiện thường khoảng 4–6%.`}
        >
          <Input id="goal-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} aria-invalid={rate.trim() !== '' && !validRate} />
        </Field>
        <ChoiceChips label="Chọn nhanh lợi nhuận" value={RATE_CHOICES.includes(rate) ? rate : null} onChange={setRate} options={RATE_CHOICES.map((r) => ({ value: r, label: `${r}%` }))} />

        <Field
          label="Số tiền đã có sẵn"
          htmlFor="goal-initial"
          error={errors.initial_amount}
          hint="Tiền đã để dành cho quỹ này từ trước, không lấy từ tiền tiết kiệm ghi trong app."
        >
          <AmountInput id="goal-initial" value={initial} onValueChange={setInitial} />
        </Field>

        <Field label="Ghi chú" htmlFor="goal-note" error={errors.note}>
          <Textarea id="goal-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="VD: Gửi tiết kiệm ngân hàng XXX. Đánh giá 3 tháng một lần." />
        </Field>
      </DialogBody>
      <DialogFooter>
        {/* In the footer, not at the end of the scrolling body: it must stay in view while the amount, months and rate above are adjusted. */}
        <PlanPreview preview={preview} monthlySaving={monthlySaving} otherMonthly={otherMonthly} />
        <Button type="submit" size="lg" className="w-full" disabled={pending || effectiveTarget <= 0 || !validMonths || !validRate}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {goal ? 'Lưu thay đổi' : emergency ? 'Lưu Quỹ khẩn cấp' : 'Tạo quỹ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * The running estimate while a goal is being set up: what it needs each month, and how that fits
 * this month's "Tiết kiệm/Đầu tư" budget together with the other goals. It lives in the dialog's
 * footer so it is always in view, and stays compact (about 80px) because on a phone with the
 * keyboard open the footer shares a very short sheet with the fields being edited.
 */
function PlanPreview({
  preview,
  monthlySaving,
  otherMonthly,
}: {
  preview: { monthly: number; deadline: string } | null
  monthlySaving: number
  otherMonthly: number
}) {
  if (!preview) {
    return (
      <p className="mb-2.5 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
        <Info className="size-3.5 shrink-0" aria-hidden />
        Nhập số tiền, số tháng và lợi nhuận để xem số cần tiết kiệm mỗi tháng.
      </p>
    )
  }

  const total = otherMonthly + preview.monthly
  const verdict = feasibility(total, monthlySaving)
  const share = monthlySaving > 0 ? total / monthlySaving : 0
  const bad = verdict === 'not_feasible'
  const chip =
    verdict === 'unknown'
      ? null
      : bad
        ? { text: `Vượt ${formatVND(total - monthlySaving)}`, Icon: TriangleAlert }
        : { text: verdict === 'feasible' ? 'Phù hợp' : 'Còn dư', Icon: CircleCheck }

  return (
    <div
      className={cn('mb-2.5 rounded-xl px-3 py-2 transition-colors', verdict === 'unknown' ? 'bg-brand-soft' : bad ? 'bg-[color-mix(in_oklab,var(--s-warning)_14%,var(--surface))]' : 'bg-brand-soft')}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[15px] font-semibold text-ink tabular-nums">
          Cần ~{formatVND(preview.monthly)}
          <span className="text-xs font-normal text-ink-2">/tháng</span>
        </p>
        {chip ? (
          <span
            title={bad ? 'Vượt ngân sách tiết kiệm của tháng. Giảm mục tiêu hoặc kéo dài thời hạn.' : undefined}
            className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', bad ? 'text-warning' : 'text-positive')}
          >
            <chip.Icon className="size-3.5" aria-hidden />
            {chip.text}
          </span>
        ) : null}
      </div>
      {verdict !== 'unknown' ? (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface/70"
          role="meter"
          aria-label="Tổng các quỹ so với ngân sách tiết kiệm tháng"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(share, 1) * 100)}
        >
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(share, 1) * 100}%`, background: bad ? 'var(--s-warning)' : 'var(--s-good)' }} />
        </div>
      ) : null}
      <p className="mt-1 text-[11px] leading-snug text-ink-2">
        Hạn {formatDate(preview.deadline)}
        {verdict === 'unknown'
          ? ' · chưa đặt ngân sách tiết kiệm tháng này nên chưa so sánh được'
          : ` · ${otherMonthly > 0 ? 'cùng các quỹ khác' : 'tổng'} ${formatVND(total)}/tháng, ${formatPercent(share, 0)} ngân sách tiết kiệm`}
      </p>
    </div>
  )
}

// ---- Allocate (one or many goals) -----------------------------------------------------

export function AllocateDialog({
  open,
  onClose,
  progresses,
  available,
  focusGoalId,
}: {
  open: boolean
  onClose: () => void
  /** Active goals, in display order. */
  progresses: GoalProgress[]
  available: number
  focusGoalId: string | null
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Phân bổ tiền tiết kiệm" description={`Chưa phân bổ: ${formatVND(available)}. Chia vào một hoặc nhiều quỹ.`}>
      {open ? <AllocateForm key={focusGoalId ?? 'all'} progresses={progresses} available={available} focusGoalId={focusGoalId} onDone={onClose} /> : null}
    </Dialog>
  )
}

function AllocateForm({
  progresses,
  available,
  focusGoalId,
  onDone,
}: {
  progresses: GoalProgress[]
  available: number
  focusGoalId: string | null
  onDone: () => void
}) {
  const ordered = focusGoalId ? [...progresses].sort((a, b) => (a.goal.id === focusGoalId ? -1 : b.goal.id === focusGoalId ? 1 : 0)) : progresses
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const total = Object.values(amounts).reduce((sum, v) => sum + v, 0)
  const left = available - total
  const over = left < 0

  function submit() {
    const items = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([goalId, amount]) => ({ goalId, amount }))
    startTransition(async () => {
      const result = await runAction(() => allocateSavings({ items, date, note }))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      const names = items.map((i) => progresses.find((p) => p.goal.id === i.goalId)?.goal.name).filter(Boolean)
      onDone()
      afterDialogClose(() => toast.success(`Đã phân bổ ${formatVND(total)}`, { description: names.join(', ') }))
    })
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <DialogBody className="space-y-3">
        <div
          className={cn(
            'sticky top-0 z-10 flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm transition-colors',
            over ? 'bg-negative/10 text-negative' : 'bg-brand-soft text-ink',
          )}
          aria-live="polite"
        >
          <span>{over ? 'Vượt quá số chưa phân bổ' : 'Còn lại chưa phân bổ'}</span>
          <span className="font-semibold tabular-nums">{formatVND(left)}</span>
        </div>

        {ordered.map((p, i) => {
          const value = amounts[p.goal.id] ?? 0
          const suggestion = Math.min(p.fromNow.amount, Math.max(0, left + value))
          return (
            <div key={p.goal.id} className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{p.goal.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {formatVND(p.accrual.balance)} / {formatVND(p.target)}
                </span>
              </div>
              <AmountInput
                value={value}
                onValueChange={(next) => setAmounts((a) => ({ ...a, [p.goal.id]: next }))}
                aria-label={`Số tiền cho ${p.goal.name}`}
                data-autofocus={i === 0 ? '' : undefined}
                className="h-10"
              />
              {!p.fromNow.done && suggestion > 0 && suggestion !== value ? (
                <button
                  type="button"
                  onClick={() => setAmounts((a) => ({ ...a, [p.goal.id]: suggestion }))}
                  className="mt-1.5 text-xs font-medium text-brand-ink hover:underline"
                >
                  Điền {formatVND(suggestion)} {suggestion === p.fromNow.amount ? '(đủ tháng này)' : '(phần còn lại)'}
                </button>
              ) : null}
            </div>
          )
        })}

        <Field label="Ngày" htmlFor="allocate-date">
          <DatePicker id="allocate-date" label="Ngày phân bổ" value={date} onChange={setDate} max={todayISO()} />
        </Field>
        <Field label="Ghi chú" htmlFor="allocate-note">
          <Input id="allocate-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Không bắt buộc" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={pending || total <= 0 || over}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {total > 0 ? `Phân bổ ${formatVND(total)}` : 'Nhập số tiền để phân bổ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---- Take money out: withdraw back to the pool, or spend it -----------------------------

export type TakeOutMode = 'withdraw' | 'spend'

const SPEND_CATEGORIES: SpendingCategory[] = ['essential', 'non_essential', 'incidental']

export function TakeOutDialog({
  progress,
  initialMode = 'spend',
  items,
  usage,
  onClose,
}: {
  progress: GoalProgress | null
  initialMode?: TakeOutMode
  items: ItemRecord[]
  usage: ItemUsage[]
  onClose: () => void
}) {
  return (
    <Dialog open={progress !== null} onClose={onClose} title={progress ? `Lấy tiền từ ${progress.goal.name}` : 'Lấy tiền từ quỹ'}>
      {progress ? <TakeOutForm key={progress.goal.id} progress={progress} initialMode={initialMode} items={items} usage={usage} onDone={onClose} /> : null}
    </Dialog>
  )
}

function TakeOutForm({
  progress,
  initialMode,
  items,
  usage,
  onDone,
}: {
  progress: GoalProgress
  initialMode: TakeOutMode
  items: ItemRecord[]
  usage: ItemUsage[]
  onDone: () => void
}) {
  const { goal } = progress
  const withdrawMax = Math.max(0, progress.allocated)
  const spendMax = Math.max(0, Math.floor(progress.accrual.balance))
  const [mode, setMode] = useState<TakeOutMode>(withdrawMax > 0 ? initialMode : 'spend')
  const [amount, setAmount] = useState(0)
  // A goal named like an item ("Du lịch") starts with that item picked; the emergency fund starts empty.
  const [item, setItem] = useState<ItemRecord | null>(() =>
    goal.kind === 'emergency' ? null : (items.find((i) => i.kind === 'expense' && !i.archived_at && itemKey(i.name) === itemKey(goal.name)) ?? null),
  )
  const [category, setCategory] = useState<SpendingCategory>(goal.kind === 'emergency' ? 'incidental' : 'non_essential')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const max = mode === 'withdraw' ? withdrawMax : spendMax
  const tooMuch = amount > max
  const canSubmit = amount > 0 && !tooMuch && (mode === 'withdraw' || item !== null)

  function submit() {
    if (!canSubmit) return
    startTransition(async () => {
      if (mode === 'withdraw') {
        const result = await runAction(() => allocateSavings({ items: [{ goalId: goal.id, amount: -amount }], date, note }))
        if (!result) return
        if (!result.ok) return void toast.error(result.error)
        onDone()
        afterDialogClose(() =>
          toast.success(`Đã rút ${formatVND(amount)}`, { description: `Từ “${goal.name}” về tiền tiết kiệm chưa phân bổ.` }),
        )
        return
      }
      if (!item) return
      const result = await runAction(() => spendFromGoal({ goalId: goal.id, amount, itemId: item.id, category, date, note }))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      const transactionId = result.transactionId
      onDone()
      afterDialogClose(() => {
        toast.success(`Đã chi ${formatVND(amount)} từ “${goal.name}”`, {
          description: `Đã ghi “${item.name}” vào Thu chi, đánh dấu chi từ quỹ.`,
          action: transactionId
            ? {
                label: 'Hoàn tác',
                onClick: () => {
                  void (async () => {
                    const undo = await runAction(() => deleteTransaction(transactionId))
                    if (!undo) return
                    if (!undo.ok) return toast.error(undo.error)
                    if (result.clearedMark) await runAction(() => markNoSpend(date))
                    toast.success('Đã hoàn tác', { description: `${formatVND(amount)} đã về lại “${goal.name}”.` })
                  })()
                },
              }
            : undefined,
        })
        if (result.budgetAlert) showBudgetAlert(result.budgetAlert, date)
      })
    })
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <DialogBody className="space-y-4">
        <Segmented
          label="Cách lấy tiền"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setAmount(0)
          }}
          options={[
            { value: 'spend', label: 'Chi tiêu từ quỹ' },
            { value: 'withdraw', label: 'Rút về tiết kiệm' },
          ]}
        />
        <p className="-mt-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          {mode === 'spend' ? (
            <>
              Dùng khi bạn <strong className="font-semibold text-ink">tiêu tiền của quỹ</strong> (đi du lịch, sửa xe…). App ghi một khoản chi vào Thu chi,
              trừ vào quỹ, và tiền đó rời hẳn khỏi tiền tiết kiệm. Mặc định khoản này không bị tính vào thặng dư của tháng.
            </>
          ) : (
            <>
              Dùng khi bạn <strong className="font-semibold text-ink">đổi kế hoạch</strong>, muốn chuyển tiền sang quỹ khác. Tiền quay về phần tiết kiệm chưa
              phân bổ, không tạo giao dịch thu chi nào.
            </>
          )}
        </p>

        {mode === 'withdraw' && withdrawMax <= 0 ? (
          <p className="text-sm text-muted">Quỹ này chưa có tiền phân bổ để rút. Tiền có sẵn từ đầu và tiền lãi chỉ dùng được bằng cách chi từ quỹ.</p>
        ) : (
          <>
            <Field
              label={mode === 'spend' ? 'Số tiền đã chi' : 'Số tiền rút'}
              htmlFor="takeout-amount"
              error={tooMuch ? `Tối đa ${formatVND(max)}.` : undefined}
              hint={mode === 'spend' ? `Quỹ hiện có ${formatVND(spendMax)}.` : `Đã phân bổ vào quỹ: ${formatVND(withdrawMax)}.`}
            >
              <AmountInput id="takeout-amount" value={amount} onValueChange={setAmount} data-autofocus="" aria-invalid={tooMuch} />
            </Field>
            {max > 0 && amount !== max ? (
              <button type="button" onClick={() => setAmount(max)} className="-mt-2 text-xs font-medium text-brand-ink hover:underline">
                {mode === 'spend' ? 'Dùng hết' : 'Rút hết'} {formatVND(max)}
              </button>
            ) : null}

            {mode === 'spend' ? (
              <>
                <Field label="Khoản mục" htmlFor="takeout-item">
                  <ItemPicker
                    id="takeout-item"
                    kind="expense"
                    items={items}
                    usage={usage}
                    value={item}
                    onChange={(next) => setItem(next)}
                    newItemCategory={category}
                    placeholder="Tìm hoặc chọn: Vé máy bay, Sửa xe…"
                  />
                </Field>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink-2">Phân loại</p>
                  <ChoiceChips
                    label="Phân loại"
                    value={category}
                    onChange={setCategory}
                    options={SPEND_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color }))}
                  />
                </div>
              </>
            ) : null}

            <Field label="Ngày" htmlFor="takeout-date">
              <DatePicker id="takeout-date" label={mode === 'spend' ? 'Ngày chi' : 'Ngày rút'} value={date} onChange={setDate} max={todayISO()} />
            </Field>
            <Field label="Ghi chú" htmlFor="takeout-note">
              <Input id="takeout-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Không bắt buộc" />
            </Field>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" size="lg" variant={mode === 'spend' ? 'primary' : 'secondary'} className="w-full" disabled={pending || !canSubmit}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {amount > 0 ? (mode === 'spend' ? `Ghi chi ${formatVND(amount)}` : `Rút ${formatVND(amount)}`) : 'Nhập số tiền'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---- Detail: milestones, history and management ----------------------------------------

export function GoalDetailDialog({
  progress,
  allocations,
  onClose,
  onEdit,
  onDelete,
}: {
  progress: GoalProgress | null
  allocations: AllocationRecord[]
  onClose: () => void
  onEdit: (goal: GoalRecord) => void
  /** Asks the page to confirm and delete the goal. */
  onDelete: (progress: GoalProgress) => void
}) {
  return (
    <Dialog open={progress !== null} onClose={onClose} title={progress?.goal.name ?? 'Chi tiết quỹ'} description={progress ? `Hạn ${formatDate(progress.deadline)} · ${GOAL_PLACES[progress.goal.place].label}` : undefined}>
      {progress ? (
        <GoalDetail
          key={progress.goal.id}
          progress={progress}
          allocations={allocations.filter((a) => a.goal_id === progress.goal.id)}
          onClose={onClose}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  )
}

function GoalDetail({
  progress,
  allocations,
  onClose,
  onEdit,
  onDelete,
}: {
  progress: GoalProgress
  allocations: AllocationRecord[]
  onClose: () => void
  onEdit: (goal: GoalRecord) => void
  onDelete: (progress: GoalProgress) => void
}) {
  const { goal } = progress
  const [pending, startTransition] = useTransition()
  const archived = goal.archived_at !== null

  function run(action: () => Promise<{ ok: boolean; error?: string } | null>, success: string, close = true) {
    startTransition(async () => {
      const result = await action()
      if (!result) return
      if (!result.ok) return void toast.error(result.error ?? 'Không thực hiện được.')
      if (close) {
        onClose()
        afterDialogClose(() => toast.success(success))
      } else {
        toast.success(success)
      }
    })
  }

  return (
    <>
      <DialogBody className="space-y-5">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Hiện có', formatVND(progress.accrual.balance)],
            ['Mục tiêu', formatVND(progress.target)],
            ['Đã phân bổ (còn lại)', formatVND(progress.allocated)],
            ['Đã chi từ quỹ', formatVND(progress.spent)],
            ['Có sẵn từ đầu', formatVND(goal.initial_amount)],
            ['Lãi tới nay', `+${formatVND(progress.accrual.interest)}`],
            ['Rút ra thực tế ≈', formatVND(progress.withdrawable)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 px-3 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="milestones-title">
          <h3 id="milestones-title" className="text-sm font-semibold">
            Cột mốc đánh giá
          </h3>
          <ol className="mt-2 space-y-2">
            {progress.milestones.map((m) => (
              <li key={m.share} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                    m.reached ? 'bg-[var(--s-good)] text-white' : 'border border-line-strong text-muted',
                  )}
                >
                  {m.reached ? <Check className="icon-pop size-3.5" strokeWidth={3} aria-hidden /> : `${m.share * 100}%`}
                </span>
                <span className="min-w-0 flex-1">
                  {formatDate(m.date)}: ≥ {formatVND(m.amount)}
                </span>
                <span className={cn('text-xs', m.reached ? 'text-positive' : 'text-muted')}>{m.reached ? 'Đã đạt' : 'Chưa đạt'}</span>
              </li>
            ))}
          </ol>
        </section>

        {goal.note ? (
          <section>
            <h3 className="text-sm font-semibold">Ghi chú</h3>
            <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{goal.note}</p>
          </section>
        ) : null}

        <section aria-labelledby="history-title">
          <h3 id="history-title" className="text-sm font-semibold">
            Lịch sử nạp, rút và chi
          </h3>
          {allocations.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Chưa có lần phân bổ nào.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
              {allocations.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={cn('flex items-center gap-1.5 font-medium tabular-nums', a.amount < 0 ? 'text-ink' : 'text-positive')}>
                      {formatSignedVND(a.amount)}
                      <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold text-muted">
                        {a.transaction_id ? 'Chi từ quỹ' : a.amount < 0 ? 'Rút' : 'Nạp'}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(a.allocated_on)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  {a.transaction_id ? (
                    <span className="max-w-28 shrink-0 text-right text-[11px] leading-tight text-muted">Sửa/xoá ở trang Thu chi</span>
                  ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={`Xoá lần ${a.amount < 0 ? 'rút' : 'phân bổ'} ${formatVND(Math.abs(a.amount))}`}
                    onClick={() => run(() => runAction(() => deleteAllocation(a.id)), 'Đã xoá khỏi lịch sử', false)}
                  >
                    <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
                  </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogBody>
      <DialogFooter>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              onClose()
              onEdit(goal)
            }}
          >
            <Pencil className="size-4" aria-hidden />
            Sửa
          </Button>
          {goal.kind === 'custom' ? (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => runAction(() => setGoalArchived(goal.id, !archived)), archived ? 'Đã đưa quỹ trở lại' : 'Đã lưu trữ quỹ')}
            >
              {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
              {archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
            </Button>
          ) : null}
          <Button
            variant="danger-ghost"
            disabled={pending}
            onClick={() => {
              onClose()
              onDelete(progress)
            }}
            aria-label={`Xoá ${goal.name}`}
          >
            <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
            Xoá
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
