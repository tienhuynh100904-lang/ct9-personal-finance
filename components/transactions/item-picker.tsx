'use client'

import { ArchiveRestore, LoaderCircle, Plus } from 'lucide-react'
import { useMemo, useState, type Ref } from 'react'
import { Input } from '@/components/ui/field'
import { createItem, restoreItem } from '@/lib/actions/items'
import { cn } from '@/lib/cn'
import type { Category, Kind } from '@/lib/finance'
import { normalizeText } from '@/lib/format'
import { cleanItemName, itemKey } from '@/lib/items'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { MAX_ITEM_LENGTH } from '@/lib/validation'
import { buildItemOptions } from './suggestions'

const chip = 'h-10 max-w-full shrink-0 truncate rounded-full border px-3.5 text-sm transition-colors disabled:opacity-60'

/**
 * Picks the item ("khoản mục") of an entry from the user's list. The text box searches the list
 * (accents ignored); a name that is not in the list offers "+ Tạo …", so a new item is one tap away
 * and the list never fills with near-duplicates by accident. `onChange` gets the picked item (or
 * `null` when the text no longer names one) and the category that item suggests.
 *
 * The parent supplies the label and error (a `Field`); this renders the box and the chips.
 */
export function ItemPicker({
  id,
  kind,
  items,
  usage,
  value,
  onChange,
  onPicked,
  newItemCategory = null,
  placeholder,
  invalid,
  describedBy,
  inputRef,
}: {
  id: string
  kind: Kind
  items: ItemRecord[]
  usage: ItemUsage[]
  value: ItemRecord | null
  onChange: (item: ItemRecord | null, suggestedCategory: Category | null) => void
  /** After a tap on a chip, "Tạo …" or "Dùng lại …" (not while typing): e.g. move on to the amount. */
  onPicked?: () => void
  /** The default category a newly created item gets (usually the one already chosen for the entry). */
  newItemCategory?: Category | null
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  inputRef?: Ref<HTMLInputElement>
}) {
  const [text, setText] = useState(value?.name ?? '')
  // Items made here: the page's list only catches up after the server round trip.
  const [created, setCreated] = useState<ItemRecord[]>([])
  const [busy, setBusy] = useState(false)

  const all = useMemo(() => {
    const known = new Set(items.map((i) => i.id))
    return [...items.filter((i) => i.kind === kind), ...created.filter((i) => i.kind === kind && !known.has(i.id))]
  }, [items, created, kind])
  const options = useMemo(() => buildItemOptions(kind, all, usage, value?.id), [kind, all, usage, value?.id])

  const typed = normalizeText(text.trim())
  const visible = typed ? options.filter((o) => normalizeText(o.item.name).includes(typed)) : options
  const key = itemKey(text)
  const exact = key ? options.find((o) => itemKey(o.item.name) === key) : undefined
  // The typed name belongs to a hidden item: offer to bring it back instead of failing as a duplicate.
  const hidden = key && !exact ? all.find((i) => i.archived_at && itemKey(i.name) === key) : undefined
  const name = cleanItemName(text)
  const canCreate = name !== '' && !exact && !hidden && name.length <= MAX_ITEM_LENGTH

  function pick(item: ItemRecord, category: Category | null) {
    setText(item.name)
    onChange(item, category)
  }

  function choose(item: ItemRecord, category: Category | null) {
    pick(item, category)
    onPicked?.()
  }

  function type(next: string) {
    setText(next)
    const match = buildItemOptions(kind, all, usage, value?.id).find((o) => itemKey(o.item.name) === itemKey(next))
    if (match) onChange(match.item, match.category)
    else if (value) onChange(null, null)
  }

  async function create() {
    if (!canCreate || busy) return
    setBusy(true)
    const result = await runAction(() => createItem({ kind, name, default_category: newItemCategory }))
    setBusy(false)
    if (!result) return
    if (!result.ok || !result.id) return void toast.error(result.ok ? 'Không thêm được khoản mục.' : result.error)
    const item: ItemRecord = { id: result.id, kind, name, default_category: newItemCategory, archived_at: null }
    setCreated((list) => [...list, item])
    choose(item, null)
    toast.success('Đã thêm khoản mục mới', { description: `“${name}”` })
  }

  async function reviveHidden(item: ItemRecord) {
    if (busy) return
    setBusy(true)
    const result = await runAction(() => restoreItem(item.id))
    setBusy(false)
    if (!result) return
    if (!result.ok) return void toast.error(result.error)
    const back = { ...item, archived_at: null }
    setCreated((list) => [...list.filter((i) => i.id !== back.id), back])
    choose(back, back.default_category)
  }

  return (
    <>
      <Input
        ref={inputRef}
        id={id}
        value={text}
        onChange={(e) => type(e.target.value)}
        placeholder={placeholder ?? 'Tìm hoặc chọn khoản mục'}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={MAX_ITEM_LENGTH}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <div
        role="group"
        aria-label="Khoản mục trong danh mục"
        className="mt-2 -mr-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto overscroll-contain py-0.5 pr-2"
      >
        {canCreate ? (
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className={cn(chip, 'inline-flex items-center gap-1.5 border-dashed border-brand-edge bg-brand-soft font-medium text-brand-ink hover:bg-brand-soft/70')}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            <span className="truncate">Tạo “{name}”</span>
          </button>
        ) : null}
        {hidden ? (
          <button
            type="button"
            onClick={() => void reviveHidden(hidden)}
            disabled={busy}
            className={cn(chip, 'inline-flex items-center gap-1.5 border-dashed border-line-strong bg-surface font-medium text-ink-2 hover:bg-surface-2')}
          >
            <ArchiveRestore className="size-4" aria-hidden />
            <span className="truncate">Dùng lại “{hidden.name}” (đã ẩn)</span>
          </button>
        ) : null}
        {visible.map((o) => (
          <button
            key={o.item.id}
            type="button"
            onClick={() => choose(o.item, o.category)}
            aria-pressed={o.item.id === value?.id}
            className={cn(
              chip,
              o.item.id === value?.id
                ? 'border-brand-edge bg-brand text-on-brand'
                : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-2',
            )}
          >
            {o.item.name}
          </button>
        ))}
        {visible.length === 0 && !canCreate && !hidden ? <p className="py-1 text-sm text-muted">Chưa có khoản mục nào. Gõ tên để tạo.</p> : null}
      </div>
    </>
  )
}
