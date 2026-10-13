'use client'

import { Check, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/choice'
import { Input, Select } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { createItem, deleteItem, updateItem } from '@/lib/actions/items'
import { CATEGORY_META } from '@/lib/categories'
import { categoriesFor, type Category, type Kind } from '@/lib/finance'
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
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as Category | null)}
      className="h-10"
    >
      <option value="">Tự động (như lần trước)</option>
      {categoriesFor(kind).map((c) => (
        <option key={c} value={c}>
          {CATEGORY_META[c].label}
        </option>
      ))}
    </Select>
  )
}

export function ItemsManager({ items, usage }: { items: ItemRecord[]; usage: ItemUsage[] }) {
  const [kind, setKind] = useState<Kind>('expense')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<Category | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const usageByName = useMemo(() => {
    const map = new Map<string, ItemUsage>()
    for (const u of usage) if (u.kind === kind) map.set(u.item, u)
    return map
  }, [usage, kind])

  const list = items
    .filter((i) => i.kind === kind)
    .sort((a, b) => (usageByName.get(b.name)?.uses ?? 0) - (usageByName.get(a.name)?.uses ?? 0) || a.name.localeCompare(b.name, 'vi'))

  const known = new Set(list.map((i) => i.name))
  const unlisted = [...usageByName.values()].filter((u) => !known.has(u.item))

  function add(name: string, category: Category | null) {
    startTransition(async () => {
      const result = await createItem({ kind, name, default_category: category })
      if (result.ok) {
        toast(result.message ?? 'Đã thêm.')
        setNewName('')
        setNewCategory(null)
      } else {
        toast(result.fieldErrors?.name ? `${result.error}` : result.error, 'error')
      }
    })
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
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={kind === 'expense' ? 'Tên khoản mục chi, VD: Đổ xăng' : 'Tên khoản thu, VD: Lương'}
          aria-label="Tên khoản mục mới"
          maxLength={100}
          className="h-10"
        />
        <CategorySelect kind={kind} value={newCategory} onChange={setNewCategory} label="Phân loại mặc định" />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <Plus className="size-4" aria-hidden />
          Thêm
        </Button>
      </form>

      <ul className="divide-y divide-line">
        {list.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">Chưa có khoản mục nào.</li>
        ) : (
          list.map((item) =>
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
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <DeleteButton item={item} />
              </li>
            ),
          )
        )}
      </ul>

      {unlisted.length > 0 ? (
        <div className="border-t border-line p-4 sm:p-5">
          <p className="text-sm font-medium">Đã dùng nhưng chưa có trong danh mục</p>
          <p className="mt-0.5 text-xs text-muted">Bấm để thêm, kèm phân loại đã dùng gần nhất.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlisted.map((u) => (
              <button
                key={u.item}
                type="button"
                disabled={pending}
                onClick={() => add(u.item, u.last_category)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 text-[13px] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
              >
                <Plus className="size-3.5" aria-hidden />
                {u.item}
                <span className="text-muted">({u.uses})</span>
              </button>
            ))}
          </div>
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
      const result = await updateItem({
        id: item.id,
        oldName: item.name,
        item: { kind: item.kind, name, default_category: category },
        renameTransactions,
      })
      if (result.ok) {
        toast(result.message ?? 'Đã lưu.')
        onDone()
      } else {
        toast(result.error, 'error')
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
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={renameTransactions}
            onChange={(e) => setRenameTransactions(e.target.checked)}
            className="size-4 accent-[var(--ink)]"
          />
          Đổi tên cả các giao dịch đã ghi “{item.name}” (gộp nếu tên mới đã tồn tại)
        </label>
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
        <Trash2 className="size-4" aria-hidden />
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
            const result = await deleteItem(item.id)
            if (result.ok) toast(result.message ?? 'Đã xoá.')
            else {
              toast(result.error, 'error')
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
