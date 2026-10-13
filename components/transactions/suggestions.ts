import type { Category, Kind } from '@/lib/finance'
import type { ItemRecord, ItemUsage } from '@/lib/types'

export type ItemSuggestion = { name: string; category: Category | null; uses: number }

/**
 * Merges the curated item list with what was actually used: the most used
 * items come first, and each suggests a category — the one set in "Danh mục",
 * otherwise the one used last time.
 */
export function buildSuggestions(kind: Kind, items: ItemRecord[], usage: ItemUsage[]): ItemSuggestion[] {
  const byName = new Map<string, ItemSuggestion>()
  for (const u of usage) {
    if (u.kind === kind) byName.set(u.item, { name: u.item, category: u.last_category, uses: u.uses })
  }
  for (const item of items) {
    if (item.kind !== kind) continue
    const used = byName.get(item.name)
    byName.set(item.name, {
      name: item.name,
      category: item.default_category ?? used?.category ?? null,
      uses: used?.uses ?? 0,
    })
  }
  return [...byName.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'vi'))
}
