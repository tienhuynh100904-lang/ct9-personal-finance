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

/** Shown only until the user has a few items of their own; never written to the database. */
const STARTER_ITEMS: Record<Kind, { name: string; category: Category }[]> = {
  expense: [
    { name: 'Ăn uống', category: 'essential' },
    { name: 'Đi chợ', category: 'essential' },
    { name: 'Xăng xe', category: 'essential' },
    { name: 'Tiền nhà', category: 'essential' },
    { name: 'Điện nước', category: 'essential' },
    { name: 'Cà phê', category: 'non_essential' },
    { name: 'Mua sắm', category: 'non_essential' },
    { name: 'Sức khoẻ', category: 'incidental' },
  ],
  income: [
    { name: 'Lương', category: 'main' },
    { name: 'Làm thêm', category: 'side' },
    { name: 'Thưởng', category: 'irregular' },
  ],
}

const MIN_OWN_ITEMS = 4

/** Adds starter items when the account has fewer than four items of its own (first run). */
export function withStarterItems(kind: Kind, suggestions: ItemSuggestion[]): ItemSuggestion[] {
  if (suggestions.length >= MIN_OWN_ITEMS) return suggestions
  const have = new Set(suggestions.map((s) => s.name.toLowerCase()))
  const starters = STARTER_ITEMS[kind]
    .filter((s) => !have.has(s.name.toLowerCase()))
    .map((s) => ({ name: s.name, category: s.category, uses: 0 }))
  return [...suggestions, ...starters]
}
