'use client'

import { ArrowDownLeft, ArrowUpRight, Check, LoaderCircle, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { Field, Input } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { deleteRecurring, saveRecurring, setRecurringActive } from '@/lib/actions/recurring'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { categoriesFor, isCategoryOf, type Category, type Kind } from '@/lib/finance'
import { formatSignedVND } from '@/lib/format'
import type { RecurringRecord } from '@/lib/recurring'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'
import type { FieldErrors, RecurringInput } from '@/lib/validation'

/** One-tap starting points for the usual monthly entries. */
const TEMPLATES: { item: string; kind: Kind; category: Category; day: number }[] = [
  { item: 'Tiền nhà', kind: 'expense', category: 'essential', day: 1 },
  { item: 'Điện', kind: 'expense', category: 'essential', day: 5 },
  { item: 'Nước', kind: 'expense', category: 'essential', day: 5 },
  { item: 'Wifi', kind: 'expense', category: 'essential', day: 10 },
  { item: 'Lương', kind: 'income', category: 'main', day: 5 },
]

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: i + 1 >= 29 ? `Ngày ${i + 1} (tháng ngắn hơn: ngày cuối tháng)` : `Ngày ${i + 1}`,
}))

type Draft = { kind: Kind; item: string; category: Category | null; amount: number; day: number }

const EMPTY: Draft = { kind: 'expense', item: '', category: null, amount: 0, day: 1 }

export function RecurringManager({ rules }: { rules: RecurringRecord[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<RecurringInput>>({})
  const [pending, startTransition] = useTransition()

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function edit(rule: RecurringRecord) {
    setEditingId(rule.id)
    setErrors({})
    setDraft({ kind: rule.kind, item: rule.item, category: rule.category, amount: rule.amount, day: rule.day_of_month })
    document.getElementById('recurring')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function reset() {
    setEditingId(null)
    setDraft(EMPTY)
    setErrors({})
  }

  function submit() {
    const input: RecurringInput = {
      id: editingId ?? undefined,
      kind: draft.kind,
      item: draft.item,
      category: draft.category as Category,
      amount: draft.amount,
      day_of_month: draft.day,
    }
    startTransition(async () => {
      const result = await runAction(() => saveRecurring(input))
      if (!result) return
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      toast.success(editingId ? 'Đã lưu khoản định kỳ' : 'Đã thêm khoản định kỳ', {
        description: `“${draft.item.trim()}” · ngày ${draft.day} hằng tháng`,
      })
      reset()
    })
  }

  return (
    <Card id="recurring" className="scroll-mt-24">
      <CardHeader
        title="Giao dịch định kỳ"
        description="Tiền nhà, điện nước, wifi, lương… Mỗi tháng đến ngày, trang Tổng quan gợi ý sẵn để bạn chỉ cần xác nhận."
      />

      <form
        className="space-y-4 border-b border-line p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
      >
        {editingId ? null : (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Chọn nhanh</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.item}
                  type="button"
                  onClick={() => update({ item: t.item, kind: t.kind, category: t.category, day: t.day })}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-xs">
            <Segmented
              label="Loại"
              value={draft.kind}
              onChange={(kind) => update({ kind, category: draft.category && isCategoryOf(kind, draft.category) ? draft.category : null })}
              options={[
                { value: 'expense', label: 'Chi tiêu' },
                { value: 'income', label: 'Thu nhập' },
              ]}
            />
          </div>
          <Field label="Khoản mục" htmlFor="recurring-item" error={errors.item}>
            <Input
              id="recurring-item"
              value={draft.item}
              onChange={(e) => update({ item: e.target.value })}
              placeholder={draft.kind === 'income' ? 'VD: Lương' : 'VD: Tiền nhà, Điện nước…'}
              maxLength={100}
              aria-invalid={Boolean(errors.item)}
            />
          </Field>
          <Field label="Số tiền mỗi tháng" htmlFor="recurring-amount" error={errors.amount} hint="Khoản thay đổi theo tháng (điện, nước) vẫn sửa được lúc xác nhận.">
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
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">Ngày trong tháng</p>
            <Select label="Ngày trong tháng" value={String(draft.day)} onValueChange={(v) => update({ day: Number(v) })} options={DAY_OPTIONS} />
            {errors.day_of_month ? <p className="mt-1.5 text-xs font-medium text-negative">{errors.day_of_month}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !draft.item.trim() || draft.amount <= 0}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : editingId ? <Check className="size-4" aria-hidden /> : <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />}
            {editingId ? 'Lưu thay đổi' : 'Thêm khoản định kỳ'}
          </Button>
          {editingId ? (
            <Button variant="ghost" onClick={reset} disabled={pending}>
              <X className="size-4" aria-hidden />
              Huỷ sửa
            </Button>
          ) : null}
        </div>
      </form>

      <ul className="divide-y divide-line">
        {rules.length === 0 ? (
          <li className="flex flex-col items-center px-5 py-8 text-center">
            <Repeat className="icon-float size-6 text-muted" aria-hidden />
            <p className="mt-2 text-sm text-muted">Chưa có khoản định kỳ nào. Chọn nhanh một mẫu ở trên để bắt đầu.</p>
          </li>
        ) : (
          rules.map((rule) => <RuleRow key={rule.id} rule={rule} editing={rule.id === editingId} onEdit={() => edit(rule)} />)
        )}
      </ul>
    </Card>
  )
}

function RuleRow({ rule, editing, onEdit }: { rule: RecurringRecord; editing: boolean; onEdit: () => void }) {
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
    <li className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', editing && 'bg-brand-soft/60', !rule.active && 'opacity-60')}>
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
