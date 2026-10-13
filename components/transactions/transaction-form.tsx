'use client'

import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useId, useMemo, useRef, useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { toast } from '@/lib/toast'
import { markNoSpend } from '@/lib/actions/day-marks'
import { deleteTransaction, saveTransaction } from '@/lib/actions/transactions'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import type { ComposerPreset, EditableTransaction } from '@/lib/composer'
import { todayISO } from '@/lib/dates'
import { categoriesFor, isCategoryOf, type Category, type Kind } from '@/lib/finance'
import { formatDayMonth, formatSignedVND, formatVND, normalizeText } from '@/lib/format'
import { addDays, weekdayShort } from '@/lib/habit'
import { runAction } from '@/lib/run-action'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { validateTransaction, type FieldErrors, type TransactionInput } from '@/lib/validation'
import { buildSuggestions, withStarterItems } from './suggestions'

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
  const [item, setItem] = useState(initial?.item ?? preset?.item ?? '')
  const [category, setCategory] = useState<Category | null>(initial?.category ?? preset?.category ?? null)
  const [date, setDate] = useState(startDate)
  const [dateMode, setDateMode] = useState<DateMode>(initialDateMode(startDate, today))
  const [note, setNote] = useState(initial?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.note))
  const [errors, setErrors] = useState<FieldErrors<TransactionInput>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const suggestions = useMemo(
    () => withStarterItems(kind, buildSuggestions(kind, items, usage)),
    [kind, items, usage],
  )

  // Suggestions narrow as you type (accent-insensitive), replacing the browser's own dropdown.
  const typed = normalizeText(item.trim())
  const visibleSuggestions = typed ? suggestions.filter((s) => normalizeText(s.name).includes(typed)) : suggestions

  function applySuggestedCategory(name: string, forKind: Kind) {
    if (categoryTouched.current) return
    const match = withStarterItems(forKind, buildSuggestions(forKind, items, usage)).find((s) => s.name === name.trim())
    if (match?.category) setCategory(match.category)
  }

  function changeKind(next: Kind) {
    setKind(next)
    categoryTouched.current = false
    setCategory(null)
    applySuggestedCategory(item, next)
    setErrors({})
  }

  function changeItem(name: string) {
    setItem(name)
    applySuggestedCategory(name, kind)
  }

  function pickQuick(name: string, suggested: Category | null) {
    setItem(name)
    if (suggested && !categoryTouched.current) setCategory(suggested)
    // Close the keyboard if it was open for the item field; the amount is what's left to type.
    itemRef.current?.blur()
    if (amount === 0) amountRef.current?.focus()
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
      item,
      category: category as Category,
      amount,
      occurred_on: date,
      note,
    }
    const check = validateTransaction(input)
    if (!check.ok) {
      setErrors(check.fieldErrors)
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
      const detail = `“${check.value.item}” · ${signed}`
      if (addAnother) {
        toast.success('Đã lưu giao dịch', { description: detail })
        setAmount(0)
        setItem('')
        setNote('')
        setNoteOpen(false)
        setCategory(null)
        categoryTouched.current = false
        amountRef.current?.focus()
        return
      }
      onDone()
      // Toast once the dialog has closed, so the toast does not jump from the dialog to the page.
      window.setTimeout(() => {
        if (initial) {
          toast.success('Đã cập nhật giao dịch', { description: detail })
          return
        }
        const id = result.id
        const savedDay = check.value.occurred_on
        toast.success('Đã lưu giao dịch', {
          description: detail,
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
                    toast.success('Đã hoàn tác', { description: 'Giao dịch vừa lưu đã được xoá.' })
                  })()
                },
              }
            : undefined,
        })
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

        <Field label="Khoản mục" htmlFor={`${formId}-item`} error={errors.item}>
          <Input
            ref={itemRef}
            id={`${formId}-item`}
            value={item}
            onChange={(e) => changeItem(e.target.value)}
            placeholder={kind === 'income' ? 'VD: Lương, Thưởng…' : 'VD: Ăn uống, Di chuyển…'}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={100}
            aria-invalid={Boolean(errors.item)}
            aria-describedby={errors.item ? `${formId}-item-error` : undefined}
          />
          {visibleSuggestions.length > 0 ? (
            <div
              role="group"
              aria-label="Khoản mục hay dùng"
              className="no-scrollbar -mx-5 mt-2 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pb-1"
            >
              {visibleSuggestions.slice(0, 10).map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => pickQuick(s.name, s.category)}
                  className={cn(
                    'h-10 shrink-0 snap-start rounded-full border px-3.5 text-sm transition-colors',
                    s.name === item.trim()
                      ? 'border-brand-edge bg-brand text-on-brand'
                      : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-2',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}
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
            <Field label="Chọn ngày" htmlFor={`${formId}-date`} error={errors.occurred_on} className="mt-3">
              <Input
                id={`${formId}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                aria-invalid={Boolean(errors.occurred_on)}
                aria-describedby={errors.occurred_on ? `${formId}-date-error` : undefined}
              />
            </Field>
          ) : errors.occurred_on ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-negative">
              {errors.occurred_on}
            </p>
          ) : null}
        </div>

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
