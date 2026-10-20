'use client'

import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Plus, Repeat, Trash2 } from 'lucide-react'
import { useId, useRef, useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldError, Textarea } from '@/components/ui/field'
import { toast } from '@/lib/toast'
import { markNoSpend } from '@/lib/actions/day-marks'
import { createRecurringFromTransaction, deleteRecurring } from '@/lib/actions/recurring'
import { deleteTransaction, saveTransaction } from '@/lib/actions/transactions'
import { showBudgetAlert } from '@/lib/budget-alert-toast'
import { longDateLabel } from '@/lib/calendar'
import { CATEGORY_META } from '@/lib/categories'
import type { ComposerPreset, EditableTransaction } from '@/lib/composer'
import { todayISO } from '@/lib/dates'
import { categoriesFor, isCategoryOf, type Category, type Kind } from '@/lib/finance'
import { formatDayMonth, formatSignedVND, formatVND } from '@/lib/format'
import { addDays, weekdayShort } from '@/lib/habit'
import { runAction } from '@/lib/run-action'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { validateTransaction, type FieldErrors, type TransactionInput } from '@/lib/validation'
import { ItemPicker } from './item-picker'

type DateMode = 'today' | 'yesterday' | 'other'

/** Editing or backfilling an older day starts with the date field revealed ("other"). */
function initialDateMode(date: string, today: string): DateMode {
  return date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : 'other'
}

/** "T2, 12/10" — with the year when it is not the current one ("T2, 12/10/25"). */
function otherDateLabel(date: string, today: string): string {
  const year = date.slice(0, 4) === today.slice(0, 4) ? '' : `/${date.slice(2, 4)}`
  return `${weekdayShort(date)}, ${formatDayMonth(date)}${year}`
}

export function TransactionForm({
  initial,
  initialKind,
  initialDate,
  preset,
  items,
  usage,
  onDone,
}: {
  initial: EditableTransaction | null
  initialKind: Kind
  initialDate: string | null
  preset: ComposerPreset | null
  items: ItemRecord[]
  usage: ItemUsage[]
  onDone: () => void
}) {
  const formId = useId()
  const itemRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  // A preset (or an existing transaction) already chose its category: don't overwrite it.
  const categoryTouched = useRef(Boolean(initial || preset))
  const today = todayISO()
  const startDate = initial?.occurred_on ?? initialDate ?? today

  const [kind, setKind] = useState<Kind>(initial?.kind ?? initialKind)
  const [amount, setAmount] = useState(initial?.amount ?? preset?.amount ?? 0)
  const [item, setItem] = useState<ItemRecord | null>(() => {
    const id = initial?.item_id ?? preset?.item_id
    if (!id) return null
    const listed = items.find((i) => i.id === id)
    if (listed) return listed
    // An entry whose item is not in the list (just removed): keep it editable under its own name.
    return initial ? { id, kind: initial.kind, name: initial.item, default_category: null, archived_at: null } : null
  })
  /** Bumped to start the item picker over (new kind, or "Lưu, thêm tiếp"). */
  const [pickerKey, setPickerKey] = useState(0)
  const [category, setCategory] = useState<Category | null>(initial?.category ?? preset?.category ?? null)
  const [date, setDate] = useState(startDate)
  const [dateMode, setDateMode] = useState<DateMode>(initialDateMode(startDate, today))
  const [note, setNote] = useState(initial?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.note))
  const [errors, setErrors] = useState<FieldErrors<TransactionInput>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /** "Lặp lại hằng tháng": after saving, the entry also becomes a monthly recurring rule. */
  const [repeatMonthly, setRepeatMonthly] = useState(false)
  const [pending, startTransition] = useTransition()

  /** The picker reports a pick (or typing that names an item); the item's category is only suggested. */
  function changeItem(next: ItemRecord | null, suggested: Category | null) {
    setItem(next)
    if (next && suggested && !categoryTouched.current) setCategory(suggested)
  }

  /** After tapping an item chip the amount is what is left to type: close the keyboard, then focus it. */
  function itemPicked() {
    itemRef.current?.blur()
    if (amount === 0) amountRef.current?.focus()
  }

  function changeKind(next: Kind) {
    setKind(next)
    categoryTouched.current = false
    setCategory(null)
    setItem(null)
    setPickerKey((k) => k + 1)
    setErrors({})
  }

  function chooseDateMode(mode: DateMode) {
    setDateMode(mode)
    if (mode === 'today') setDate(today)
    else if (mode === 'yesterday') setDate(addDays(today, -1))
  }

  function submit(addAnother: boolean) {
    const input: TransactionInput = {
      id: initial?.id,
      kind,
      item_id: item?.id ?? '',
      category: category as Category,
      amount,
      occurred_on: date,
      note,
    }
    const check = validateTransaction(input)
    if (!check.ok) {
      setErrors(
        check.fieldErrors.item_id
          ? { ...check.fieldErrors, item_id: 'Chọn khoản mục trong danh sách, hoặc bấm “Tạo …” nếu là khoản mới.' }
          : check.fieldErrors,
      )
      return
    }
    setErrors({})
    startTransition(async () => {
      const result = await runAction(() => saveTransaction(input))
      if (!result) return
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      const signed = formatSignedVND(kind === 'income' ? amount : -amount)
      const itemName = item?.name ?? ''
      const detail = `“${itemName}” · ${signed}`
      const savedDay = check.value.occurred_on
      // Turning the entry into a monthly rule is a follow-up: the transaction itself is already saved.
      const makeRecurring: Promise<string | null> =
        repeatMonthly && !initial && result.id
          ? runAction(() => createRecurringFromTransaction(result.id!)).then((made) => {
              if (made && !made.ok) toast.error(made.error)
              return made?.ok ? (made.id ?? null) : null
            })
          : Promise.resolve(null)
      const warnBudget = () => {
        if (result.budgetAlert) showBudgetAlert(result.budgetAlert, savedDay)
      }
      if (addAnother) {
        toast.success('Đã lưu giao dịch', { description: detail })
        warnBudget()
        void makeRecurring.then((ruleId) => {
          if (ruleId) toast.success('Đã đặt lặp lại hằng tháng', { description: `“${itemName}” · ngày ${Number(savedDay.slice(8))} mỗi tháng` })
        })
        setRepeatMonthly(false)
        setAmount(0)
        setItem(null)
        setPickerKey((k) => k + 1)
        setNote('')
        setNoteOpen(false)
        setCategory(null)
        categoryTouched.current = false
        amountRef.current?.focus()
        return
      }
      onDone()
      // Toast once the dialog has closed, so the toast does not jump from the dialog to the page.
      window.setTimeout(async () => {
        if (initial) {
          toast.success('Đã cập nhật giao dịch', { description: detail })
          warnBudget()
          return
        }
        const id = result.id
        const ruleId = await makeRecurring
        toast.success(ruleId ? 'Đã lưu và đặt lặp lại hằng tháng' : 'Đã lưu giao dịch', {
          description: ruleId ? `${detail} · ngày ${Number(savedDay.slice(8))} mỗi tháng` : detail,
          action: id
            ? {
                label: 'Hoàn tác',
                onClick: () => {
                  void (async () => {
                    const undo = await runAction(() => deleteTransaction(id))
                    if (!undo) return
                    if (!undo.ok) return toast.error(undo.error)
                    // Saving removed a "Không chi tiêu" mark: undoing the entry puts it back.
                    if (result.clearedMark) await runAction(() => markNoSpend(savedDay))
                    // The monthly rule made from this entry goes too.
                    if (ruleId) await runAction(() => deleteRecurring(ruleId))
                    toast.success('Đã hoàn tác', { description: 'Giao dịch vừa lưu đã được xoá.' })
                  })()
                },
              }
            : undefined,
        })
        warnBudget()
      }, 150)
    })
  }

  function remove() {
    if (!initial) return
    startTransition(async () => {
      const result = await runAction(() => deleteTransaction(initial.id))
      if (!result) return
      if (!result.ok) {
        setConfirmingDelete(false)
        toast.error(result.error)
        return
      }
      onDone()
      window.setTimeout(
        () => toast.success('Đã xoá giao dịch', { description: `“${initial.item}” · ${formatVND(initial.amount)}` }),
        150,
      )
    })
  }

  const categoryOptions = categoriesFor(kind).map((c) => ({
    value: c,
    label: CATEGORY_META[c].label,
    dot: CATEGORY_META[c].color,
  }))
  const dateOptions: { value: DateMode; label: string }[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'other', label: dateMode === 'other' && date !== today && date !== addDays(today, -1) ? otherDateLabel(date, today) : 'Ngày khác' },
  ]

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <DialogBody className="space-y-4">
        {initial?.from_savings ? (
          <p className="rounded-xl bg-[color-mix(in_oklab,var(--c-saving)_10%,var(--surface))] px-3 py-2.5 text-xs leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">Khoản chi từ quỹ.</strong> Sửa số tiền hoặc ngày thì quỹ được cập nhật theo. Xoá giao dịch này thì
            tiền về lại quỹ. Đổi sang khoản thu hoặc nhóm Tiết kiệm thì nó thôi là chi từ quỹ.
          </p>
        ) : null}
        <Segmented
          label="Loại giao dịch"
          value={kind}
          onChange={changeKind}
          options={[
            {
              value: 'expense',
              label: (
                <>
                  <ArrowUpRight className="size-4 text-expense" aria-hidden /> Chi tiêu
                </>
              ),
            },
            {
              value: 'income',
              label: (
                <>
                  <ArrowDownLeft className="size-4 text-positive" aria-hidden /> Thu nhập
                </>
              ),
            },
          ]}
        />


        <Field label="Số tiền" htmlFor={`${formId}-amount`} error={errors.amount}>
          <AmountInput
            ref={amountRef}
            id={`${formId}-amount`}
            data-autofocus={initial ? undefined : ''}
            value={amount}
            onValueChange={setAmount}
            selectOnFocus={Boolean(preset)}
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                itemRef.current?.focus()
              }
            }}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? `${formId}-amount-error` : undefined}
            className="h-16 text-[26px] font-semibold tracking-tight min-[380px]:text-[30px] sm:text-[30px]"
          />
        </Field>

        <Field label="Khoản mục" htmlFor={`${formId}-item`} error={errors.item_id}>
          <ItemPicker
            key={`${kind}-${pickerKey}`}
            id={`${formId}-item`}
            kind={kind}
            items={items}
            usage={usage}
            value={item}
            onChange={changeItem}
            onPicked={itemPicked}
            newItemCategory={category && isCategoryOf(kind, category) ? category : null}
            placeholder={kind === 'income' ? 'Tìm hoặc chọn: Lương, Thưởng…' : 'Tìm hoặc chọn: Ăn uống, Di chuyển…'}
            invalid={Boolean(errors.item_id)}
            describedBy={errors.item_id ? `${formId}-item-error` : undefined}
            inputRef={itemRef}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Phân loại</p>
          <ChoiceChips
            label="Phân loại"
            value={category && isCategoryOf(kind, category) ? category : null}
            onChange={(value) => {
              categoryTouched.current = true
              setCategory(value)
            }}
            options={categoryOptions}
          />
          {errors.category ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-negative">
              {errors.category}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Ngày</p>
          <ChoiceChips label="Ngày giao dịch" value={dateMode} onChange={chooseDateMode} options={dateOptions} />
          {dateMode === 'other' ? (
            <div className="mt-3 rounded-2xl border border-line bg-surface-2/60 p-2 sm:p-3">
              <Calendar value={date} onChange={setDate} today={today} label="Ngày giao dịch" />
              <p className="mt-2 border-t border-line px-1 pt-2 text-center text-sm font-medium text-ink-2">
                {longDateLabel(date)}
              </p>
              {errors.occurred_on ? <FieldError id={`${formId}-date-error`}>{errors.occurred_on}</FieldError> : null}
            </div>
          ) : errors.occurred_on ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-negative">
              {errors.occurred_on}
            </p>
          ) : null}
        </div>

        {initial ? null : (
          <Checkbox
            checked={repeatMonthly}
            onChange={(e) => setRepeatMonthly(e.target.checked)}
            hint={`Ngày ${Number(date.slice(8))} mỗi tháng, app sẽ gợi ý sẵn để bạn chỉ cần xác nhận.`}
            card
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Repeat className="size-4 text-brand-ink" aria-hidden />
              Lặp lại hằng tháng
            </span>
          </Checkbox>
        )}

        {noteOpen ? (
          <Field label="Ghi chú" htmlFor={`${formId}-note`} error={errors.note}>
            <Textarea
              id={`${formId}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Không bắt buộc"
              rows={2}
              maxLength={500}
              autoFocus={!initial?.note}
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="group -ml-1 inline-flex h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-brand-ink hover:underline"
          >
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
            Thêm ghi chú
          </button>
        )}
      </DialogBody>

      <DialogFooter>
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Xoá giao dịch này? Không thể hoàn tác.</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                Huỷ
              </Button>
              <Button variant="danger" onClick={remove} disabled={pending}>
                {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="icon-hover-wiggle size-4" aria-hidden />}
                Xoá
              </Button>
            </div>
          </div>
        ) : initial ? (
          <div className="flex items-center gap-2">
            <Button variant="danger-ghost" size="lg" onClick={() => setConfirmingDelete(true)} disabled={pending}>
              <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
              Xoá
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="min-w-0 flex-1">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              Cập nhật
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" compact onClick={() => submit(true)} disabled={pending} className="min-w-0">
              Lưu, thêm tiếp
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="min-w-0">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              Lưu
            </Button>
          </div>
        )}
      </DialogFooter>
    </form>
  )
}
