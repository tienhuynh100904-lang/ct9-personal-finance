'use client'

import { ArrowDownLeft, ArrowUpRight, Check, LoaderCircle, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { deleteRecurring, saveRecurring, setRecurringActive } from '@/lib/actions/recurring'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { categoriesFor, isCategoryOf, type Category, type Kind } from '@/lib/finance'
import { formatSignedVND } from '@/lib/format'
import type { RecurringRecord } from '@/lib/recurring'
import { runAction } from '@/lib/run-action'
import { afterDialogClose, toast } from '@/lib/toast'
import type { FieldErrors, RecurringInput } from '@/lib/validation'

/** One-tap starting points for the usual monthly entries. */
const TEMPLATES: { item: string; kind: Kind; category: Category; day: number }[] = [
  { item: 'Tiền nhà', kind: 'expense', category: 'essential', day: 1 },
  { item: 'Điện', kind: 'expense', category: 'essential', day: 5 },
  { item: 'Nước', kind: 'expense', category: 'essential', day: 5 },
  { item: 'Wifi', kind: 'expense', category: 'essential', day: 10 },
  { item: 'Lương', kind: 'income', category: 'main', day: 5 },
]

/** Quick days; "Cuối tháng" is 31, which falls on the last day of shorter months. */
const DAY_CHOICES = ['1', '5', '10', '15', '20', '25', '31']

type Draft = { kind: Kind; item: string; category: Category | null; amount: number; day: string }

/**
 * Giao dịch định kỳ in Cài đặt: a clean list, with adding and editing in a dialog so the page
 * does not carry a form.
 */
export function RecurringManager({ rules }: { rules: RecurringRecord[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; rule: RecurringRecord | null }>({ open: false, rule: null })
  const openAdd = () => setDialog({ open: true, rule: null })

  return (
    <Card id="recurring" className="scroll-mt-24">
      <CardHeader
        title="Giao dịch định kỳ"
        description="Tiền nhà, điện nước, wifi, lương… Mỗi tháng đến ngày, trang Tổng quan gợi ý sẵn để bạn chỉ cần xác nhận."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
            Thêm
          </Button>
        }
      />

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {rules.length === 0 ? (
          <li className="flex flex-col items-center px-5 py-8 text-center">
            <Repeat className="icon-float size-6 text-muted" aria-hidden />
            <p className="mt-2 text-sm text-muted">Chưa có khoản định kỳ nào. Thêm tiền nhà, điện, wifi, lương… để app gợi ý mỗi tháng.</p>
            <Button variant="brand" className="mt-2" onClick={openAdd}>
              Thêm khoản đầu tiên
            </Button>
          </li>
        ) : (
          rules.map((rule) => <RuleRow key={rule.id} rule={rule} onEdit={() => setDialog({ open: true, rule })} />)
        )}
      </ul>

      <Dialog
        open={dialog.open}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        title={dialog.rule ? `Sửa “${dialog.rule.item}”` : 'Thêm khoản định kỳ'}
        description="Mỗi tháng đến ngày, app gợi ý sẵn để bạn chỉ cần xác nhận. App không tự ghi."
      >
        {dialog.open ? (
          <RecurringForm key={dialog.rule?.id ?? 'new'} rule={dialog.rule} onDone={() => setDialog((d) => ({ ...d, open: false }))} />
        ) : null}
      </Dialog>
    </Card>
  )
}

function RecurringForm({ rule, onDone }: { rule: RecurringRecord | null; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(
    rule
      ? { kind: rule.kind, item: rule.item, category: rule.category, amount: rule.amount, day: String(rule.day_of_month) }
      : { kind: 'expense', item: '', category: null, amount: 0, day: '1' },
  )
  const [errors, setErrors] = useState<FieldErrors<RecurringInput>>({})
  const [pending, startTransition] = useTransition()

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  const day = Number(draft.day)
  const validDay = Number.isInteger(day) && day >= 1 && day <= 31
  const canSubmit = draft.item.trim() !== '' && draft.amount > 0 && draft.category !== null && validDay

  function submit() {
    if (!canSubmit) return
    const input: RecurringInput = {
      id: rule?.id,
      kind: draft.kind,
      item: draft.item,
      category: draft.category as Category,
      amount: draft.amount,
      day_of_month: day,
    }
    startTransition(async () => {
      const result = await runAction(() => saveRecurring(input))
      if (!result) return
      if (!result.ok) {
        // The dialog stays open, so the error is shown inside it.
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      onDone()
      afterDialogClose(() =>
        toast.success(rule ? 'Đã lưu khoản định kỳ' : 'Đã thêm khoản định kỳ', {
          description: `“${draft.item.trim()}” · ngày ${day} hằng tháng`,
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
        {rule ? null : (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Chọn nhanh</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.item}
                  type="button"
                  onClick={() => update({ item: t.item, kind: t.kind, category: t.category, day: String(t.day) })}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-10',
                    draft.item === t.item ? 'border-brand-edge bg-brand text-on-brand' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {t.kind === 'income' ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                  {t.item}
                </button>
              ))}
            </div>
          </div>
        )}

        <Segmented
          label="Loại"
          value={draft.kind}
          onChange={(kind) => update({ kind, category: draft.category && isCategoryOf(kind, draft.category) ? draft.category : null })}
          options={[
            { value: 'expense', label: 'Chi tiêu' },
            { value: 'income', label: 'Thu nhập' },
          ]}
        />

        <Field label="Khoản mục" htmlFor="recurring-item" error={errors.item}>
          <Input
            id="recurring-item"
            data-autofocus={rule ? undefined : ''}
            value={draft.item}
            onChange={(e) => update({ item: e.target.value })}
            placeholder={draft.kind === 'income' ? 'VD: Lương' : 'VD: Tiền nhà, Điện nước…'}
            maxLength={100}
            aria-invalid={Boolean(errors.item)}
          />
        </Field>

        <Field label="Số tiền mỗi tháng" htmlFor="recurring-amount" error={errors.amount} hint="Khoản đổi theo tháng (điện, nước) vẫn sửa được lúc xác nhận.">
          <AmountInput id="recurring-amount" value={draft.amount} onValueChange={(amount) => update({ amount })} aria-invalid={Boolean(errors.amount)} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Phân loại</p>
          <ChoiceChips
            label="Phân loại"
            value={draft.category}
            onChange={(category) => update({ category })}
            options={categoriesFor(draft.kind).map((c) => ({ value: c, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color }))}
          />
          {errors.category ? <p className="mt-1.5 text-xs font-medium text-negative">{errors.category}</p> : null}
        </div>

        <Field
          label="Ngày trong tháng"
          htmlFor="recurring-day"
          error={errors.day_of_month ?? (draft.day !== '' && !validDay ? 'Chọn ngày từ 1 đến 31.' : undefined)}
          hint="Ngày 29–31: tháng ngắn hơn sẽ rơi vào ngày cuối tháng."
        >
          <Input
            id="recurring-day"
            inputMode="numeric"
            value={draft.day}
            onChange={(e) => update({ day: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            aria-invalid={draft.day !== '' && !validDay}
          />
        </Field>
        <ChoiceChips
          label="Chọn nhanh ngày"
          value={DAY_CHOICES.includes(draft.day) ? draft.day : null}
          onChange={(value) => update({ day: value })}
          options={DAY_CHOICES.map((d) => ({ value: d, label: d === '31' ? 'Cuối tháng' : `Ngày ${d}` }))}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={pending || !canSubmit}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {rule ? 'Lưu thay đổi' : 'Thêm khoản định kỳ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RuleRow({ rule, onEdit }: { rule: RecurringRecord; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const income = rule.kind === 'income'

  function toggle(active: boolean) {
    startTransition(async () => {
      const result = await runAction(() => setRecurringActive(rule.id, active))
      if (result && !result.ok) toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await runAction(() => deleteRecurring(rule.id))
      if (!result) return
      if (result.ok) toast.success('Đã xoá khoản định kỳ', { description: 'Các giao dịch đã ghi trước đây vẫn được giữ nguyên.' })
      else {
        toast.error(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', !rule.active && 'opacity-60')}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-surface-2', income ? 'text-positive' : 'text-expense')}>
        {income ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{rule.item}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="size-2 rounded-full" style={{ background: CATEGORY_META[rule.category].color }} />
            {CATEGORY_META[rule.category].label}
          </span>
          <span className="whitespace-nowrap">Ngày {rule.day_of_month} hằng tháng</span>
          {rule.active ? null : <span className="whitespace-nowrap">Đang tạm dừng</span>}
        </p>
      </div>
      <p className={cn('text-sm font-semibold tabular-nums', income ? 'text-positive' : 'text-ink')}>
        {formatSignedVND(income ? rule.amount : -rule.amount)}
      </p>
      {confirming ? (
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
            Xoá
          </Button>
        </div>
      ) : (
        <div className="flex items-center">
          <Switch checked={rule.active} onCheckedChange={toggle} disabled={pending} aria-label={`${rule.active ? 'Tạm dừng' : 'Bật lại'} ${rule.item}`} />
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Sửa ${rule.item}`}>
            <Pencil className="icon-hover-wiggle size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setConfirming(true)} aria-label={`Xoá ${rule.item}`}>
            <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
          </Button>
        </div>
      )}
    </li>
  )
}
