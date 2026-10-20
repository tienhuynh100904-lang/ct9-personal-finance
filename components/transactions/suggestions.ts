import type { Category, Kind } from '@/lib/finance'
import type { ItemRecord, ItemUsage } from '@/lib/types'

export type ItemOption = {
  item: ItemRecord
  uses: number
  /** What picking this item suggests as the entry's category: the one set in "Danh mục", else the one used last time. */
  category: Category | null
}

/**
 * The items of one kind that can be picked, most used first. Hidden (archived) items are left out,
 * except `keepId`: the item an entry being edited already belongs to.
 */
export function buildItemOptions(
  kind: Kind,
  items: readonly ItemRecord[],
  usage: readonly ItemUsage[],
  keepId?: string | null,
): ItemOption[] {
  const usageById = new Map(usage.map((u) => [u.item_id, u]))
  return items
    .filter((i) => i.kind === kind && (!i.archived_at || i.id === keepId))
    .map((item) => {
      const used = usageById.get(item.id)
      return { item, uses: used?.uses ?? 0, category: item.default_category ?? used?.last_category ?? null }
    })
    .sort((a, b) => b.uses - a.uses || a.item.name.localeCompare(b.item.name, 'vi'))
}
