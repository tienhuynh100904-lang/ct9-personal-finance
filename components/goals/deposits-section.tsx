'use client'

import { CalendarClock, Check, ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Landmark, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { StatTile } from '@/components/ui/stat-tile'
import { deleteDeposit, renewDeposit, reopenDeposit, saveDeposit, settleDeposit } from '@/lib/actions/deposits'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/dates'
import {
  depositsOverSavings,
  expectedInterest,
  maturityOf,
  MAX_DEPOSIT_RATE_BP,
  MAX_DEPOSIT_TERM_MONTHS,
  sortedDeposits,
  summarizeDeposits,
  type DepositRecord,
  type DepositState,
  type DepositView,
} from '@/lib/deposits'
import { formatDate, formatVND } from '@/lib/format'
import type { SavingsPool } from '@/lib/goals'
import { runAction } from '@/lib/run-action'
import { afterDialogClose, toast } from '@/lib/toast'
import type { DepositInput, FieldErrors } from '@/lib/validation'
import { bpToPercent, percentToBp } from './goal-dialogs'

const TERM_CHOICES = ['1', '3', '6', '12', '18', '24']
const RATE_CHOICES = ['4', '5', '6', '7']

const STATE: Record<DepositState, { className: string }> = {
  matured: { className: 'bg-[color-mix(in_oklab,var(--s-critical)_14%,var(--surface))] text-negative' },
  soon: { className: 'bg-[color-mix(in_oklab,var(--s-warning)_22%,var(--surface))] text-warning' },
  later: { className: 'bg-surface-2 text-ink-2' },
  closed: { className: 'bg-surface-2 text-muted' },
}

function stateLabel(view: DepositView): string {
  if (view.state === 'closed') return 'Đã tất toán'
  if (view.daysLeft < 0) return `Quá hạn ${-view.daysLeft} ngày`
  if (view.daysLeft === 0) return 'Đáo hạn hôm nay'
  return view.daysLeft === 1 ? 'Ngày mai đáo hạn' : `Còn ${view.daysLeft} ngày`
}

function termLabel(months: number): string {
  return months % 12 === 0 ? `${months / 12} năm` : `${months} tháng`
}

type FormState = { open: boolean; deposit: DepositRecord | null }

/**
 * "Khoản tiết kiệm": deposits with a term (gửi ngân hàng…), kept only to see when each one matures
 * and what it pays. It uses the same savings as the goals but is not taken out of them, so one sum
 * can sit in a goal and in a deposit at once; nothing here creates a transaction.
 */
export function DepositsSection({ deposits, pool, today }: { deposits: DepositRecord[]; pool: SavingsPool; today: string }) {
  const views = useMemo(() => sortedDeposits(deposits, today), [deposits, today])
  const summary = useMemo(() => summarizeDeposits(deposits, today), [deposits, today])
  const closed = views.filter((v) => v.state === 'closed')
  const over = depositsOverSavings(summary.principal, pool.saved, pool.spent)

  const [form, setForm] = useState<FormState>({ open: false, deposit: null })
  const [renewing, setRenewing] = useState<DepositView | null>(null)
  const [deleting, setDeleting] = useState<DepositRecord | null>(null)
  const [pending, startTransition] = useTransition()

  function settle(view: DepositView) {
    startTransition(async () => {
      const result = await runAction(() => settleDeposit(view.deposit.id))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      toast.success(`Đã tất toán “${view.deposit.name}”`, {
        description: `Nhận ${formatVND(view.payout)} khi đáo hạn.`,
        action: { label: 'Hoàn tác', onClick: () => void reopen(view.deposit.id) },
      })
    })
  }

  async function reopen(id: string) {
    const result = await runAction(() => reopenDeposit(id))
    if (result && !result.ok) toast.error(result.error)
  }

  function confirmDelete() {
    const target = deleting
    if (!target || pending) return
    startTransition(async () => {
      const result = await runAction(() => deleteDeposit(target.id))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      setDeleting(null)
      afterDialogClose(() => toast.success(`Đã xoá “${target.name}”`))
    })
  }

  return (
    <>
      <section aria-labelledby="deposits-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="deposits-title" className="text-[15px] font-semibold tracking-tight">
              Khoản tiết kiệm
            </h2>
            <p className="mt-0.5 text-xs text-muted">Theo dõi ngày đáo hạn. Không trừ vào tiền chưa phân bổ, nên vẫn có thể nằm trong một quỹ.</p>
          </div>
          <Button onClick={() => setForm({ open: true, deposit: null })}>
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
            Thêm khoản tiết kiệm
          </Button>
        </div>

        {summary.open.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile label="Đang gửi" value={formatVND(summary.principal)} color="var(--c-saving)">
              <p>{summary.open.length} khoản tiết kiệm</p>
            </StatTile>
            <StatTile label="Lãi dự kiến" value={formatVND(summary.interest)} color="var(--c-incidental)">
              <p>Khi các khoản đáo hạn</p>
            </StatTile>
            <StatTile label="Đáo hạn gần nhất" value={summary.next ? formatDate(summary.next.maturity) : '—'} className="col-span-2 lg:col-span-1">
              {summary.next ? <p>{`${summary.next.deposit.name} · ${stateLabel(summary.next).toLowerCase()}`}</p> : null}
            </StatTile>
          </div>
        ) : null}

        {over > 0 ? (
          <p className="flex items-start gap-2 rounded-2xl border border-[color-mix(in_oklab,var(--s-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-warning)_9%,var(--surface))] px-4 py-3 text-sm text-ink-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              Tổng các khoản tiết kiệm lớn hơn số đã ghi ở nhóm “Tiết kiệm/Đầu tư” {formatVND(over)}. Hãy kiểm tra lại số tiền, hoặc ghi thêm khoản tiết kiệm còn thiếu.
            </span>
          </p>
        ) : null}

        {summary.open.length === 0 ? (
          <Card className="flex flex-col items-center px-5 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
              <Landmark className="icon-float size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold">Bạn có tiền gửi ngân hàng có kỳ hạn?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Thêm khoản tiết kiệm để thấy ngày đáo hạn và số tiền lãi sẽ nhận, không lo quên tái tục hay tất toán.</p>
            <Button variant="brand" className="mt-4" onClick={() => setForm({ open: true, deposit: null })}>
              Thêm khoản tiết kiệm đầu tiên
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {summary.open.map((view, i) => (
              <DepositCard
                key={view.deposit.id}
                view={view}
                index={i}
                busy={pending}
                onSettle={() => settle(view)}
                onRenew={() => setRenewing(view)}
                onEdit={() => setForm({ open: true, deposit: view.deposit })}
                onDelete={() => setDeleting(view.deposit)}
              />
            ))}
          </div>
        )}

        {closed.length > 0 ? (
          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                Lịch sử đã tất toán ({closed.length})
                <span className="font-normal text-muted"> · tổng lãi {formatVND(closed.reduce((sum, v) => sum + v.interest, 0))}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
            </summary>
            <HistoryTable views={closed} busy={pending} onReopen={(id) => startTransition(() => reopen(id))} onDelete={setDeleting} />
          </details>
        ) : null}
      </section>

      <DepositFormDialog open={form.open} deposit={form.deposit} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      <RenewDialog view={renewing} onClose={() => setRenewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Xoá “${deleting.name}”?` : 'Xoá khoản tiết kiệm?'}
        description="Chỉ xoá bản theo dõi này. Các giao dịch tiết kiệm đã ghi và các quỹ không bị ảnh hưởng."
        confirmLabel={pending ? 'Đang xoá…' : 'Xoá'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function DepositCard({
  view,
  index,
  busy,
  onSettle,
  onRenew,
  onEdit,
  onDelete,
}: {
  view: DepositView
  index: number
  busy: boolean
  onSettle: () => void
  onRenew: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { deposit, state } = view
  const attention = state === 'matured' || state === 'soon'
  return (
    <Card className="rise-in p-4 sm:p-5" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', attention ? 'bg-[color-mix(in_oklab,var(--s-warning)_16%,var(--surface))] text-warning' : 'bg-brand-soft text-brand-ink')}>
          <Landmark className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{deposit.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            Kỳ hạn {termLabel(deposit.term_months)}
            {deposit.rate_bp > 0 ? ` · ${bpToPercent(deposit.rate_bp)}%/năm` : ''}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', STATE[state].className)}>{stateLabel(view)}</span>
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{formatVND(deposit.principal)}</p>
      <TermProgress view={view} />

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-muted">Ngày gửi</dt>
          <dd className="tabular-nums">{formatDate(deposit.start_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Đáo hạn</dt>
          <dd className={cn('font-medium tabular-nums', attention && 'text-warning')}>{formatDate(view.maturity)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-ink-2">
        Nhận <strong className="font-semibold text-ink tabular-nums">{formatVND(view.payout)}</strong>
        {view.interest > 0 ? <span className="text-muted"> (lãi +{formatVND(view.interest)})</span> : null}
      </p>
      {deposit.note ? <p className="mt-1 line-clamp-2 text-xs text-muted">{deposit.note}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-1">
        <Button size="sm" variant={attention ? 'primary' : 'secondary'} onClick={onSettle} disabled={busy}>
          <CircleCheck className="size-3.5" aria-hidden />
          Tất toán
        </Button>
        <Button size="sm" variant="ghost" onClick={onRenew} disabled={busy}>
          <RefreshCw className="size-3.5" aria-hidden />
          Tái tục
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} className="ml-auto" aria-label={`Sửa ${deposit.name}`}>
          <Pencil className="icon-hover-wiggle size-4" aria-hidden />
        </Button>
        <Button size="icon-sm" variant="danger-ghost" onClick={onDelete} aria-label={`Xoá ${deposit.name}`} title="Xoá khoản tiết kiệm">
          <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
        </Button>
      </div>
    </Card>
  )
}

/**
 * Every settled deposit with all its figures side by side, so deposits can be compared later
 * (which bank, rate or term paid best). A table that scrolls sideways on a phone, with the name
 * column pinned. Interest is what the entered rate pays over the full term.
 */
function HistoryTable({
  views,
  busy,
  onReopen,
  onDelete,
}: {
  views: DepositView[]
  busy: boolean
  onReopen: (id: string) => void
  onDelete: (deposit: DepositRecord) => void
}) {
  const head = 'whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted'
  const cell = 'whitespace-nowrap px-3 py-2.5 text-sm tabular-nums'
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[56rem] border-collapse">
        <caption className="sr-only">Các khoản tiết kiệm đã tất toán</caption>
        <thead className="bg-surface-2/50">
          <tr>
            <th scope="col" className={cn(head, 'sticky left-0 z-10 bg-surface-2')}>
              Khoản tiết kiệm
            </th>
            <th scope="col" className={cn(head, 'text-right')}>
              Số tiền gửi
            </th>
            <th scope="col" className={cn(head, 'text-right')}>
              Lãi suất
            </th>
            <th scope="col" className={head}>
              Kỳ hạn
            </th>
            <th scope="col" className={head}>
              Ngày gửi
            </th>
            <th scope="col" className={head}>
              Đáo hạn
            </th>
            <th scope="col" className={cn(head, 'text-right')}>
              Tiền lãi
            </th>
            <th scope="col" className={cn(head, 'text-right')}>
              Nhận về
            </th>
            <th scope="col" className={head}>
              Tất toán
            </th>
            <th scope="col" className={head}>
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {views.map((view) => {
            const { deposit } = view
            const early = deposit.closed_on !== null && deposit.closed_on < view.maturity
            return (
              <tr key={deposit.id}>
                <th scope="row" className="sticky left-0 z-10 max-w-48 bg-surface px-3 py-2.5 text-left text-sm font-medium">
                  <span className="block truncate" title={deposit.note ? `${deposit.name}: ${deposit.note}` : deposit.name}>
                    {deposit.name}
                  </span>
                  {deposit.note ? <span className="block truncate text-xs font-normal text-muted">{deposit.note}</span> : null}
                </th>
                <td className={cn(cell, 'text-right')}>{formatVND(deposit.principal)}</td>
                <td className={cn(cell, 'text-right')}>{deposit.rate_bp > 0 ? `${bpToPercent(deposit.rate_bp)}%/năm` : '—'}</td>
                <td className={cell}>{termLabel(deposit.term_months)}</td>
                <td className={cell}>{formatDate(deposit.start_date)}</td>
                <td className={cell}>{formatDate(view.maturity)}</td>
                <td className={cn(cell, 'text-right')}>{view.interest > 0 ? `+${formatVND(view.interest)}` : '—'}</td>
                <td className={cn(cell, 'text-right font-medium')}>{formatVND(view.payout)}</td>
                <td className={cell}>
                  {deposit.closed_on ? formatDate(deposit.closed_on) : '—'}
                  {early ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">trước hạn</span> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReopen(deposit.id)}>
                    <Undo2 className="size-3.5" aria-hidden />
                    Mở lại
                  </Button>
                  <Button size="icon-sm" variant="danger-ghost" onClick={() => onDelete(deposit)} aria-label={`Xoá ${deposit.name}`} title="Xoá khoản tiết kiệm">
                    <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** How far through its term a deposit is: the bar fills from the deposit date to the maturity date. */
function TermProgress({ view }: { view: DepositView }) {
  const percent = Math.round(view.progress * 100)
  const matured = view.state === 'matured'
  return (
    <div className="mt-3">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={`${view.deposit.name}: đã qua ${percent}% kỳ hạn`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]"
          style={{ width: `${view.progress * 100}%`, background: matured ? 'var(--s-good)' : view.state === 'soon' ? 'var(--s-warning)' : 'var(--brand)' }}
        />
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted tabular-nums">
        <span>
          {view.daysElapsed}/{view.termDays} ngày
        </span>
        <span className="font-semibold text-ink-2">{percent}%</span>
      </p>
    </div>
  )
}

// ---- Add / edit -----------------------------------------------------------------------

function DepositFormDialog({ open, deposit, onClose }: { open: boolean; deposit: DepositRecord | null; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={deposit ? `Sửa “${deposit.name}”` : 'Thêm khoản tiết kiệm'}
      description="Gửi ngân hàng có kỳ hạn. App chỉ theo dõi ngày đáo hạn và tiền lãi, không tạo giao dịch."
    >
      {open ? <DepositForm key={deposit?.id ?? 'new'} deposit={deposit} onDone={onClose} /> : null}
    </Dialog>
  )
}

function DepositForm({ deposit, onDone }: { deposit: DepositRecord | null; onDone: () => void }) {
  const [name, setName] = useState(deposit?.name ?? '')
  const [principal, setPrincipal] = useState(deposit?.principal ?? 0)
  const [startDate, setStartDate] = useState(deposit?.start_date ?? todayISO())
  const [term, setTerm] = useState(String(deposit?.term_months ?? 12))
  const [rate, setRate] = useState(deposit ? bpToPercent(deposit.rate_bp) : '')
  const [note, setNote] = useState(deposit?.note ?? '')
  const [errors, setErrors] = useState<FieldErrors<DepositInput>>({})
  const [pending, startTransition] = useTransition()

  const termNumber = Number(term)
  const rateBp = rate.trim() === '' ? 0 : percentToBp(rate)
  const validTerm = Number.isInteger(termNumber) && termNumber >= 1 && termNumber <= MAX_DEPOSIT_TERM_MONTHS
  const validRate = Number.isInteger(rateBp) && rateBp >= 0 && rateBp <= MAX_DEPOSIT_RATE_BP
  const canSubmit = name.trim() !== '' && principal > 0 && validTerm && validRate
  const preview = principal > 0 && validTerm && validRate ? { maturity: maturityOf({ start_date: startDate, term_months: termNumber }), interest: expectedInterest({ principal, rate_bp: rateBp, start_date: startDate, term_months: termNumber }) } : null

  function submit() {
    if (!canSubmit) return
    const input: DepositInput = { id: deposit?.id, name, principal, rate_bp: rateBp, start_date: startDate, term_months: termNumber, note }
    startTransition(async () => {
      const result = await runAction(() => saveDeposit(input))
      if (!result) return
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      onDone()
      afterDialogClose(() =>
        toast.success(deposit ? 'Đã lưu khoản tiết kiệm' : 'Đã thêm khoản tiết kiệm', {
          description: `“${name.trim()}” · ${formatVND(principal)}`,
        }),
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
        <Field label="Tên khoản tiết kiệm" htmlFor="deposit-name" error={errors.name}>
          <Input id="deposit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Vietcombank 12 tháng" maxLength={60} data-autofocus="" />
        </Field>

        <Field label="Số tiền gửi" htmlFor="deposit-principal" error={errors.principal}>
          <AmountInput id="deposit-principal" value={principal} onValueChange={setPrincipal} aria-invalid={Boolean(errors.principal)} />
        </Field>

        <Field label="Ngày gửi" htmlFor="deposit-start" error={errors.start_date}>
          <DatePicker id="deposit-start" label="Ngày gửi" value={startDate} onChange={setStartDate} invalid={Boolean(errors.start_date)} />
        </Field>

        <Field
          label="Kỳ hạn (tháng)"
          htmlFor="deposit-term"
          error={errors.term_months ?? (term !== '' && !validTerm ? `Từ 1 đến ${MAX_DEPOSIT_TERM_MONTHS} tháng.` : undefined)}
        >
          <Input id="deposit-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-invalid={term !== '' && !validTerm} />
        </Field>
        <ChoiceChips label="Chọn nhanh kỳ hạn" value={TERM_CHOICES.includes(term) ? term : null} onChange={setTerm} options={TERM_CHOICES.map((m) => ({ value: m, label: termLabel(Number(m)) }))} />

        <Field
          label="Lãi suất (%/năm)"
          htmlFor="deposit-rate"
          error={errors.rate_bp ?? (rate.trim() !== '' && !validRate ? `Từ 0 đến ${MAX_DEPOSIT_RATE_BP / 100}%.` : undefined)}
          hint="Để trống nếu chưa biết. Lãi tính đơn: gốc × lãi suất × số ngày / 365."
        >
          <Input id="deposit-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} aria-invalid={rate.trim() !== '' && !validRate} />
        </Field>
        <ChoiceChips label="Chọn nhanh lãi suất" value={RATE_CHOICES.includes(rate) ? rate : null} onChange={setRate} options={RATE_CHOICES.map((r) => ({ value: r, label: `${r}%` }))} />

        <Field label="Ghi chú" htmlFor="deposit-note" error={errors.note}>
          <Textarea id="deposit-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="VD: Tự động tái tục gốc, số sổ cuối 1234…" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <MaturityPreview preview={preview} />
        <Button type="submit" size="lg" className="w-full" disabled={pending || !canSubmit}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {deposit ? 'Lưu thay đổi' : 'Thêm khoản tiết kiệm'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The running answer to "when does it mature and what does it pay", always in view in the footer. */
function MaturityPreview({ preview }: { preview: { maturity: string; interest: number } | null }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-ink-2" aria-live="polite">
      <CalendarClock className="size-3.5 shrink-0 text-brand-ink" aria-hidden />
      {preview ? (
        <p className="min-w-0">
          Đáo hạn <strong className="font-semibold text-ink">{formatDate(preview.maturity)}</strong>
          {preview.interest > 0 ? ` · lãi dự kiến ${formatVND(preview.interest)}` : ''}
        </p>
      ) : (
        <p>Nhập số tiền, kỳ hạn và lãi suất để xem ngày đáo hạn.</p>
      )}
    </div>
  )
}

// ---- Renew ----------------------------------------------------------------------------

type RenewBase = 'principal' | 'payout'

function RenewDialog({ view, onClose }: { view: DepositView | null; onClose: () => void }) {
  return (
    <Dialog
      open={view !== null}
      onClose={onClose}
      title={view ? `Tái tục “${view.deposit.name}”` : 'Tái tục'}
      description="Khoản cũ được tất toán và một khoản mới bắt đầu từ ngày đáo hạn của khoản cũ."
    >
      {view ? <RenewForm key={view.deposit.id} view={view} onDone={onClose} /> : null}
    </Dialog>
  )
}

function RenewForm({ view, onDone }: { view: DepositView; onDone: () => void }) {
  const { deposit } = view
  const [base, setBase] = useState<RenewBase>('principal')
  const [principal, setPrincipal] = useState(deposit.principal)
  const [term, setTerm] = useState(String(deposit.term_months))
  const [rate, setRate] = useState(bpToPercent(deposit.rate_bp))
  const [errors, setErrors] = useState<FieldErrors<DepositInput>>({})
  const [pending, startTransition] = useTransition()

  const termNumber = Number(term)
  const rateBp = rate.trim() === '' ? 0 : percentToBp(rate)
  const validTerm = Number.isInteger(termNumber) && termNumber >= 1 && termNumber <= MAX_DEPOSIT_TERM_MONTHS
  const validRate = Number.isInteger(rateBp) && rateBp >= 0 && rateBp <= MAX_DEPOSIT_RATE_BP
  const canSubmit = principal > 0 && validTerm && validRate
  const start = view.maturity
  const preview = canSubmit ? { maturity: maturityOf({ start_date: start, term_months: termNumber }), interest: expectedInterest({ principal, rate_bp: rateBp, start_date: start, term_months: termNumber }) } : null

  function pickBase(next: RenewBase) {
    setBase(next)
    setPrincipal(next === 'principal' ? deposit.principal : view.payout)
  }

  function submit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await runAction(() => renewDeposit({ id: deposit.id, principal, rate_bp: rateBp, term_months: termNumber }))
      if (!result) return
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      onDone()
      afterDialogClose(() => toast.success(`Đã tái tục “${deposit.name}”`, { description: `${formatVND(principal)} · ${termLabel(termNumber)}` }))
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
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Khoản cũ đáo hạn {formatDate(view.maturity)}: gốc {formatVND(deposit.principal)}
          {view.interest > 0 ? `, lãi ${formatVND(view.interest)}` : ''}.
        </p>

        {view.interest > 0 ? (
          <Segmented
            label="Tái tục"
            value={base}
            onChange={pickBase}
            options={[
              { value: 'principal', label: 'Chỉ gốc' },
              { value: 'payout', label: 'Gốc + lãi' },
            ]}
          />
        ) : null}

        <Field label="Số tiền gửi tiếp" htmlFor="renew-principal" error={errors.principal}>
          <AmountInput id="renew-principal" value={principal} onValueChange={setPrincipal} aria-invalid={Boolean(errors.principal)} />
        </Field>

        <Field label="Kỳ hạn mới (tháng)" htmlFor="renew-term" error={errors.term_months ?? (term !== '' && !validTerm ? `Từ 1 đến ${MAX_DEPOSIT_TERM_MONTHS} tháng.` : undefined)}>
          <Input id="renew-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-invalid={term !== '' && !validTerm} />
        </Field>
        <ChoiceChips label="Chọn nhanh kỳ hạn" value={TERM_CHOICES.includes(term) ? term : null} onChange={setTerm} options={TERM_CHOICES.map((m) => ({ value: m, label: termLabel(Number(m)) }))} />

        <Field label="Lãi suất mới (%/năm)" htmlFor="renew-rate" error={errors.rate_bp ?? (rate.trim() !== '' && !validRate ? `Từ 0 đến ${MAX_DEPOSIT_RATE_BP / 100}%.` : undefined)}>
          <Input id="renew-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} aria-invalid={rate.trim() !== '' && !validRate} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <MaturityPreview preview={preview} />
        <Button type="submit" size="lg" className="w-full" disabled={pending || !canSubmit}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          Tái tục
        </Button>
      </DialogFooter>
    </form>
  )
}
