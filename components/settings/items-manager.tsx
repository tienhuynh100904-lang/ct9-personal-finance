'use client'

import { Check, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Segmented } from '@/components/ui/choice'
import { ClearableInput } from '@/components/ui/clearable-input'
import { Input } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { createItem, deleteItem, updateItem } from '@/lib/actions/items'
import { CATEGORY_META } from '@/lib/categories'
import { categoriesFor, type Category, type Kind } from '@/lib/finance'
import { normalizeText } from '@/lib/format'
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
const UNLISTED_PREVIEW = 12

type CategoryFilter = 'all' | 'none' | Category

export function ItemsManager({ items, usage }: { items: ItemRecord[]; usage: ItemUsage[] }) {
  const [kind, setKind] = useState<Kind>('expense')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<Category | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showAllUnlisted, setShowAllUnlisted] = useState(false)
  const [pending, startTransition] = useTransition()

  const usageByName = useMemo(() => {
    const map = new Map<string, ItemUsage>()
    for (const u of usage) if (u.kind === kind) map.set(u.item, u)
    return map
  }, [usage, kind])

  const list = useMemo(
    () =>
      items
        .filter((i) => i.kind === kind)
        .sort((a, b) => (usageByName.get(b.name)?.uses ?? 0) - (usageByName.get(a.name)?.uses ?? 0) || a.name.localeCompare(b.name, 'vi')),
    [items, kind, usageByName],
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

  const known = new Set(list.map((i) => i.name))
  const unlisted = [...usageByName.values()].filter((u) => !known.has(u.item))
  const unlistedShown = showAllUnlisted ? unlisted : unlisted.slice(0, UNLISTED_PREVIEW)

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
        description="Gợi ý khi nhập giao dịch. Phân loại mặc định được điền sẵn khi chọn khoản mục."
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
                setShowAllUnlisted(false)
              }}
              options={[
                { value: 'expense', label: 'Chi tiêu' },
                { value: 'income', label: 'Thu nhập' },
              ]}
            />
          </div>
        }
      />

      <form
        className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_16rem_auto] sm:p-5"
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
              <EditRow key={item.id} item={item} onDone={() => setEditingId(null)} />
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
                    <span>· {usageByName.get(item.name)?.uses ?? 0} giao dịch</span>
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(item.id)} aria-label={`Sửa ${item.name}`}>
                  <Pencil className="icon-hover-wiggle size-4" aria-hidden />
                </Button>
                <DeleteButton item={item} />
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

      {unlisted.length > 0 ? (
        <div className="border-t border-line p-4 sm:p-5">
          <p className="text-sm font-medium">Đã dùng nhưng chưa có trong danh mục</p>
          <p className="mt-0.5 text-xs text-muted">Bấm để thêm, kèm phân loại đã dùng gần nhất.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlistedShown.map((u) => (
              <button
                key={u.item}
                type="button"
                disabled={pending}
                onClick={() => add(u.item, u.last_category)}
                className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 text-[13px] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50 pointer-coarse:h-10"
              >
                <Plus className="size-3.5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
                {u.item}
                <span className="text-muted">({u.uses})</span>
              </button>
            ))}
          </div>
          {unlisted.length > UNLISTED_PREVIEW ? (
            <Button variant="brand" size="sm" className="mt-2" onClick={() => setShowAllUnlisted((v) => !v)}>
              {showAllUnlisted ? 'Thu gọn' : `Xem thêm ${unlisted.length - UNLISTED_PREVIEW} khoản mục`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function EditRow({ item, onDone }: { item: ItemRecord; onDone: () => void }) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<Category | null>(item.default_category)
  const [renameTransactions, setRenameTransactions] = useState(true)
  const [pending, startTransition] = useTransition()
  const renamed = name.trim() !== item.name

  function save() {
    startTransition(async () => {
      const result = await runAction(() =>
        updateItem({
          id: item.id,
          oldName: item.name,
          item: { kind: item.kind, name, default_category: category },
          renameTransactions,
        }),
      )
      if (!result) return
      if (result.ok) {
        toast.success('Đã lưu khoản mục', { description: `“${name.trim()}”` })
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
            Lưu
          </Button>
          <Button variant="ghost" size="icon" onClick={onDone} aria-label="Huỷ">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </form>
      {renamed ? (
        <Checkbox checked={renameTransactions} onChange={(e) => setRenameTransactions(e.target.checked)}>
          Đổi tên cả các giao dịch đã ghi “{item.name}” (gộp nếu tên mới đã tồn tại)
        </Checkbox>
      ) : null}
    </li>
  )
}

function DeleteButton({ item }: { item: ItemRecord }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon-sm" onClick={() => setConfirming(true)} aria-label={`Xoá ${item.name}`}>
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
            if (result.ok) toast.success('Đã xoá khỏi danh mục', { description: 'Các giao dịch cũ vẫn được giữ nguyên.' })
            else {
              toast.error(result.error)
              setConfirming(false)
            }
          })
        }
      >
        Xoá
      </Button>
    </div>
  )
}
