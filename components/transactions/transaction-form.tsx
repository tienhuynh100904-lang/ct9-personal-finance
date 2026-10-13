'use client'

import { ArrowDownLeft, ArrowUpRight, CircleCheck, LoaderCircle, Trash2 } from 'lucide-react'
import { useId, useMemo, useRef, useState, useTransition } from 'react'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { Field, Input, Textarea } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { deleteTransaction, saveTransaction } from '@/lib/actions/transactions'
import { CATEGORY_META } from '@/lib/categories'
import { cn } from '@/lib/cn'
import type { EditableTransaction } from '@/lib/composer'
import { todayISO } from '@/lib/dates'
import { categoriesFor, isCategoryOf, type Category, type Kind } from '@/lib/finance'
import { formatSignedVND } from '@/lib/format'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { validateTransaction, type FieldErrors, type TransactionInput } from '@/lib/validation'
import { buildSuggestions } from './suggestions'

const QUICK_PICK_COUNT = 8

function shiftDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function TransactionForm({
  initial,
  initialKind,
  items,
  usage,
  onDone,
}: {
  initial: EditableTransaction | null
  initialKind: Kind
  items: ItemRecord[]
  usage: ItemUsage[]
  onDone: () => void
}) {
  const formId = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const categoryTouched = useRef(Boolean(initial))

  const [kind, setKind] = useState<Kind>(initial?.kind ?? initialKind)
  const [amount, setAmount] = useState(initial?.amount ?? 0)
  const [item, setItem] = useState(initial?.item ?? '')
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null)
  const [date, setDate] = useState(initial?.occurred_on ?? todayISO())
  const [note, setNote] = useState(initial?.note ?? '')
  const [errors, setErrors] = useState<FieldErrors<TransactionInput>>({})
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const suggestions = useMemo(() => buildSuggestions(kind, items, usage), [kind, items, usage])
  const quickPicks = suggestions.slice(0, QUICK_PICK_COUNT)
  const today = todayISO()

  function applySuggestedCategory(name: string, forKind: Kind) {
    if (categoryTouched.current) return
    const match = buildSuggestions(forKind, items, usage).find((s) => s.name === name.trim())
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
      const result = await saveTransaction(input)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast(result.error, 'error')
        return
      }
      const signed = formatSignedVND(kind === 'income' ? amount : -amount)
      if (addAnother) {
        setSavedMessage(`Đã lưu “${check.value.item}” ${signed}`)
        setAmount(0)
        setItem('')
        setNote('')
        setCategory(null)
        categoryTouched.current = false
        amountRef.current?.focus()
      } else {
        toast(initial ? 'Đã cập nhật giao dịch.' : `Đã lưu “${check.value.item}” ${signed}`)
        onDone()
      }
    })
  }

  function remove() {
    if (!initial) return
    startTransition(async () => {
      const result = await deleteTransaction(initial.id)
      if (!result.ok) {
        toast(result.error, 'error')
        return
      }
      toast('Đã xoá giao dịch.')
      onDone()
    })
  }

  const categoryOptions = categoriesFor(kind).map((c) => ({
    value: c,
    label: CATEGORY_META[c].label,
    dot: CATEGORY_META[c].color,
  }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
      className="space-y-4"
      noValidate
    >
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
                <ArrowDownLeft className="size-4 text-income" aria-hidden /> Thu nhập
              </>
            ),
          },
        ]}
      />

      {savedMessage ? (
        <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm" role="status">
          <CircleCheck className="size-4 shrink-0 text-positive" aria-hidden />
          {savedMessage}
        </p>
      ) : null}

      <Field label="Số tiền" htmlFor={`${formId}-amount`} error={errors.amount}>
        <AmountInput
          ref={amountRef}
          id={`${formId}-amount`}
          data-autofocus
          value={amount}
          onValueChange={setAmount}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={errors.amount ? `${formId}-amount-error` : undefined}
          className="h-14 text-2xl font-semibold sm:text-2xl"
        />
      </Field>

      <Field label="Khoản mục" htmlFor={`${formId}-item`} error={errors.item}>
        <Input
          id={`${formId}-item`}
          list={`${formId}-items`}
          value={item}
          onChange={(e) => changeItem(e.target.value)}
          placeholder={kind === 'income' ? 'VD: Lương, Thưởng…' : 'VD: Ăn uống, Di chuyển…'}
          autoComplete="off"
          maxLength={100}
          aria-invalid={Boolean(errors.item)}
          aria-describedby={errors.item ? `${formId}-item-error` : undefined}
        />
        <datalist id={`${formId}-items`}>
          {suggestions.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
        {quickPicks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Khoản mục hay dùng">
            {quickPicks.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => changeItem(s.name)}
                className={cn(
                  'h-8 rounded-lg border px-2.5 text-[13px] transition-colors',
                  s.name === item.trim()
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2" id={`${formId}-category-label`}>
          Phân loại
        </p>
        <ChoiceChips
          label="Phân loại"
          value={category && isCategoryOf(kind, category) ? category : null}
          onChange={(value) => {
            categoryTouched.current = true
            setCategory(value)
          }}
          options={categoryOptions}
        />
        {errors.category ? <p className="mt-1.5 text-xs font-medium text-negative">{errors.category}</p> : null}
      </div>

      <Field label="Ngày" htmlFor={`${formId}-date`} error={errors.occurred_on}>
        <div className="flex gap-2">
          <Input
            id={`${formId}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="min-w-0 flex-1"
            aria-invalid={Boolean(errors.occurred_on)}
          />
          <Button variant={date === today ? 'primary' : 'soft'} size="md" onClick={() => setDate(today)} className="h-11">
            Hôm nay
          </Button>
          <Button
            variant={date === shiftDays(today, -1) ? 'primary' : 'soft'}
            size="md"
            onClick={() => setDate(shiftDays(today, -1))}
            className="h-11"
          >
            Hôm qua
          </Button>
        </div>
      </Field>

      <Field label="Ghi chú" htmlFor={`${formId}-note`} error={errors.note}>
        <Textarea
          id={`${formId}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Không bắt buộc"
          rows={2}
          maxLength={500}
        />
      </Field>

      {confirmingDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-negative/30 bg-negative/5 p-3">
          <p className="text-sm font-medium">Xoá giao dịch này? Không thể hoàn tác.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={pending}>
              Huỷ
            </Button>
            <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              Xoá
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {initial ? (
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              className="text-negative hover:text-negative"
            >
              <Trash2 className="size-4" aria-hidden />
              Xoá
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            {initial ? null : (
              <Button variant="secondary" onClick={() => submit(true)} disabled={pending}>
                Lưu & thêm tiếp
              </Button>
            )}
            <Button type="submit" disabled={pending} className="min-w-24">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              {initial ? 'Cập nhật' : 'Lưu'}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
