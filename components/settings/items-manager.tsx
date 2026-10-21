'use client'

import { ArchiveRestore, Check, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ChoiceChips, Segmented } from '@/components/ui/choice'
import { ClearableInput } from '@/components/ui/clearable-input'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { afterDialogClose, toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { createItem, deleteItem, restoreItem, updateItem } from '@/lib/actions/items'
import { CATEGORY_META } from '@/lib/categories'
import { categoriesFor, type Category, type Kind } from '@/lib/finance'
import { normalizeText } from '@/lib/format'
import { itemKey } from '@/lib/items'
import type { ItemRecord, ItemUsage } from '@/lib/types'

function CategorySelect({
  kind,
  value,
  onChange,
  label,
}: {
  kind: Kind
  value: Category | null
  onChange: (value: Category | null) => void
  label: string
}) {
  return (
    <Select
      label={label}
      value={value ?? ''}
      onValueChange={(next) => onChange((next || null) as Category | null)}
      options={[
        { value: '', label: 'Tự động (như lần trước)', hint: 'Dùng phân loại của lần ghi gần nhất' },
        ...categoriesFor(kind).map((c) => ({ value: c, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color })),
      ]}
      triggerClassName="h-10"
    />
  )
}

const PAGE_SIZE = 8

type CategoryFilter = 'all' | 'none' | Category

export function ItemsManager({ items, usage }: { items: ItemRecord[]; usage: ItemUsage[] }) {
  const [kind, setKind] = useState<Kind>('expense')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<Category | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showHidden, setShowHidden] = useState(false)
  const [pending, startTransition] = useTransition()

  const usageById = useMemo(() => new Map(usage.map((u) => [u.item_id, u])), [usage])
  const usesOf = (item: ItemRecord) => usageById.get(item.id)?.uses ?? 0

  // Items hidden because transactions still use them are kept apart from the working list.
  const list = useMemo(
    () =>
      items
        .filter((i) => i.kind === kind && !i.archived_at)
        .sort((a, b) => (usageById.get(b.id)?.uses ?? 0) - (usageById.get(a.id)?.uses ?? 0) || a.name.localeCompare(b.name, 'vi')),
    [items, kind, usageById],
  )
  const hidden = useMemo(
    () => items.filter((i) => i.kind === kind && i.archived_at).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [items, kind],
  )

  // Filter by the category an item defaults to, and by name (accent-insensitive), then paginate.
  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    return list.filter(
      (i) =>
        (categoryFilter === 'all' || (categoryFilter === 'none' ? i.default_category === null : i.default_category === categoryFilter)) &&
        (!q || normalizeText(i.name).includes(q)),
    )
  }, [list, categoryFilter, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const firstIndex = (currentPage - 1) * PAGE_SIZE
  const visible = filtered.slice(firstIndex, firstIndex + PAGE_SIZE)
  const hasFilters = categoryFilter !== 'all' || query.trim() !== ''

  const filterOptions = useMemo(() => {
    const count = (match: (i: ItemRecord) => boolean) => list.filter(match).length
    return [
      { value: 'all', label: `Tất cả phân loại (${list.length})` },
      ...categoriesFor(kind).map((c) => ({
        value: c,
        label: `${CATEGORY_META[c].label} (${count((i) => i.default_category === c)})`,
        dot: CATEGORY_META[c].color,
      })),
      { value: 'none', label: `Chưa đặt, tự động (${count((i) => i.default_category === null)})` },
    ]
  }, [list, kind])

  function add(name: string, category: Category | null) {
    startTransition(async () => {
      const result = await runAction(() => createItem({ kind, name, default_category: category }))
      if (!result) return
      if (result.ok) {
        toast.success('Đã thêm khoản mục', { description: `“${name.trim()}”` })
        setNewName('')
        setNewCategory(null)
      } else {
        toast.error(result.error)
      }
    })
  }

  function resetFilters() {
    setCategoryFilter('all')
    setQuery('')
    setPage(1)
  }

  return (
    <Card>
      <CardHeader
        title="Danh mục khoản mục"
        description="Mỗi giao dịch thuộc một khoản mục trong danh sách này. Phân loại mặc định được điền sẵn khi chọn khoản mục."
        action={
          <div className="w-52">
            <Segmented
              label="Loại khoản mục"
              value={kind}
              onChange={(value) => {
                setKind(value)
                setEditingId(null)
                setNewCategory(null)
                setCategoryFilter('all')
                setQuery('')
                setPage(1)
                setShowHidden(false)
              }}
              options={[
                { value: 'expense', label: 'Chi tiêu' },
                { value: 'income', label: 'Thu nhập' },
              ]}
            />
          </div>
        }
      />

      {/* Phones: one button, the fields live in a sheet. From `sm` the form stays in the page. */}
      <div className="border-b border-line p-4 sm:hidden">
        <Button className="w-full" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {kind === 'expense' ? 'Thêm khoản mục chi' : 'Thêm khoản thu'}
        </Button>
      </div>
      <NewItemDialog key={kind} kind={kind} open={addOpen} onClose={() => setAddOpen(false)} />

      <form
        className="hidden gap-2 border-b border-line p-4 sm:grid sm:grid-cols-[1fr_16rem_auto] sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) add(newName, newCategory)
        }}
      >
        <ClearableInput
          value={newName}
          onValueChange={setNewName}
          placeholder={kind === 'expense' ? 'Tên khoản mục chi, VD: Đổ xăng' : 'Tên khoản thu, VD: Lương'}
          aria-label="Tên khoản mục mới"
          clearLabel="Xoá tên khoản mục"
          maxLength={100}
          className="h-10"
        />
        <CategorySelect kind={kind} value={newCategory} onChange={setNewCategory} label="Phân loại mặc định" />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
          Thêm
        </Button>
      </form>

      <div className="grid gap-2 border-b border-line bg-surface-2/50 p-4 sm:grid-cols-[1fr_16rem] sm:p-5">
        <SearchInput
          label="Tìm khoản mục"
          value={query}
          onValueChange={(next) => {
            setQuery(next)
            setPage(1)
          }}
          placeholder="Tìm khoản mục…"
          className="h-10"
        />
        <Select
          label="Lọc theo phân loại"
          value={categoryFilter}
          onValueChange={(next) => {
            setCategoryFilter(next as CategoryFilter)
            setPage(1)
          }}
          options={filterOptions}
          triggerClassName="h-10"
        />
      </div>

      <ul className="divide-y divide-line">
        {list.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">Chưa có khoản mục nào.</li>
        ) : filtered.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">
            Không có khoản mục nào khớp bộ lọc.{' '}
            <button type="button" onClick={resetFilters} className="font-medium text-brand-ink underline-offset-2 hover:underline">
              Xoá bộ lọc
            </button>
          </li>
        ) : (
          visible.map((item) =>
            editingId === item.id ? (
              <EditRow key={item.id} item={item} items={items} onDone={() => setEditingId(null)} />
            ) : (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {item.default_category ? (
                      <>
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: CATEGORY_META[item.default_category].color }}
                        />
                        {CATEGORY_META[item.default_category].label}
                      </>
                    ) : (
                      'Phân loại tự động'
                    )}
                    <span>· {usesOf(item)} giao dịch</span>
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(item.id)} aria-label={`Sửa ${item.name}`}>
                  <Pencil className="icon-hover-wiggle size-4" aria-hidden />
                </Button>
                <DeleteButton item={item} uses={usesOf(item)} />
              </li>
            ),
          )
        )}
      </ul>

      {filtered.length > 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-line px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
          <p className="text-sm text-muted" aria-live="polite">
            Hiển thị {firstIndex + 1}–{firstIndex + visible.length} / {filtered.length} khoản mục
            {hasFilters ? ` (đang lọc, tổng ${list.length})` : ''}
          </p>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={(next) => {
              setPage(next)
              setEditingId(null)
            }}
            label="Phân trang khoản mục"
          />
        </div>
      ) : null}

      {hidden.length > 0 ? (
        <div className="border-t border-line p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-expanded={showHidden}
            className="text-sm font-medium text-brand-ink hover:underline"
          >
            {showHidden ? 'Thu gọn khoản mục đã ẩn' : `Khoản mục đã ẩn (${hidden.length})`}
          </button>
          {showHidden ? (
            <>
              <p className="mt-1 text-xs text-muted">Đã có giao dịch nên không xoá hẳn được. Không hiện khi nhập mới, nhưng vẫn nằm trong thống kê cũ.</p>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {hidden.map((item) => (
                  <HiddenRow key={item.id} item={item} uses={usesOf(item)} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

/** Phone sheet for a new item: name, default category, one button. Closes when the item is added. */
function NewItemDialog({ kind, open, onClose }: { kind: Kind; open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === 'expense' ? 'Thêm khoản mục chi' : 'Thêm khoản thu'}
      description="Phân loại mặc định được điền sẵn khi bạn chọn khoản mục này lúc ghi."
    >
      {open ? <NewItemForm kind={kind} onDone={onClose} /> : null}
    </Dialog>
  )
}

type CategoryChoice = Category | 'auto'

function NewItemForm({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const [name, setName] = useState('')
  const [choice, setChoice] = useState<CategoryChoice>('auto')
  const [pending, startTransition] = useTransition()
  const trimmed = name.trim()

  function submit() {
    if (!trimmed || pending) return
    startTransition(async () => {
      const result = await runAction(() => createItem({ kind, name, default_category: choice === 'auto' ? null : choice }))
      if (!result) return
      if (!result.ok) {
        // The sheet stays open so the name can be fixed.
        toast.error(result.error)
        return
      }
      onDone()
      afterDialogClose(() => toast.success('Đã thêm khoản mục', { description: `“${trimmed}”` }))
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
        <Field label="Tên khoản mục" htmlFor="new-item-name">
          <ClearableInput
            id="new-item-name"
            value={name}
            onValueChange={setName}
            placeholder={kind === 'expense' ? 'VD: Đổ xăng' : 'VD: Lương'}
            clearLabel="Xoá tên khoản mục"
            maxLength={100}
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Phân loại mặc định</p>
          <ChoiceChips
            label="Phân loại mặc định"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'auto' as const, label: 'Tự động' },
              ...categoriesFor(kind).map((c) => ({ value: c as CategoryChoice, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color })),
            ]}
          />
          <p className="mt-1.5 text-xs text-muted">Tự động: dùng phân loại của lần ghi gần nhất.</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={pending || !trimmed}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Thêm khoản mục
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditRow({ item, items, onDone }: { item: ItemRecord; items: ItemRecord[]; onDone: () => void }) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<Category | null>(item.default_category)
  const [pending, startTransition] = useTransition()
  // Another item of the same kind with this name: saving merges this one into it.
  const mergeTarget = name.trim()
    ? items.find((i) => i.id !== item.id && i.kind === item.kind && itemKey(i.name) === itemKey(name))
    : undefined

  function save() {
    startTransition(async () => {
      const result = await runAction(() => updateItem({ id: item.id, item: { kind: item.kind, name, default_category: category } }))
      if (!result) return
      if (result.ok) {
        toast.success(result.message ?? 'Đã lưu khoản mục', { description: result.merged ? 'Các giao dịch đã chuyển sang khoản mục này.' : `“${name.trim()}”` })
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <li className="space-y-2 bg-surface-2/60 px-4 py-3 sm:px-5">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_16rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên khoản mục" maxLength={100} className="h-10" autoFocus />
        <CategorySelect kind={item.kind} value={category} onChange={setCategory} label="Phân loại mặc định" />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !name.trim()} aria-label="Lưu">
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {mergeTarget ? 'Gộp' : 'Lưu'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDone} aria-label="Huỷ">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </form>
      {mergeTarget ? (
        <p className="text-xs leading-relaxed text-ink-2">
          Đã có khoản mục “{mergeTarget.name}”. Lưu sẽ <strong className="font-semibold text-ink">gộp</strong> “{item.name}” vào đó: mọi giao dịch của “{item.name}” chuyển sang “{mergeTarget.name}”.
        </p>
      ) : null}
    </li>
  )
}

function HiddenRow({ item, uses }: { item: ItemRecord; uses: number }) {
  const [pending, startTransition] = useTransition()
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-muted">{uses} giao dịch</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runAction(() => restoreItem(item.id))
            if (!result) return
            if (result.ok) toast.success('Đã hiện lại khoản mục', { description: `“${item.name}”` })
            else toast.error(result.error)
          })
        }
      >
        <ArchiveRestore className="size-4" aria-hidden />
        Hiện lại
      </Button>
    </li>
  )
}

function DeleteButton({ item, uses }: { item: ItemRecord; uses: number }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon-sm" onClick={() => setConfirming(true)} aria-label={`${uses > 0 ? 'Ẩn' : 'Xoá'} ${item.name}`}>
        <Trash2 className="icon-hover-wiggle size-4" aria-hidden />
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Huỷ
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runAction(() => deleteItem(item.id))
            if (!result) return
            if (result.ok) toast.success(result.archived ? 'Đã ẩn khỏi danh mục' : 'Đã xoá khỏi danh mục', { description: result.archived ? 'Khoản mục đã có giao dịch nên được ẩn. Các giao dịch cũ vẫn được giữ nguyên.' : undefined })
            else {
              toast.error(result.error)
              setConfirming(false)
            }
          })
        }
      >
        {uses > 0 ? 'Ẩn' : 'Xoá'}
      </Button>
    </div>
  )
}
