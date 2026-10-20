/**
 * Item ("khoản mục") names. Two names are the same item when they differ only in case or in
 * spacing ("Cà  phê" and "cà phê"); accents still matter. Mirrors `public.item_key` in
 * supabase/schema.sql, which backs the unique index on (user, kind, key).
 */
export function cleanItemName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

export function itemKey(name: string): string {
  return cleanItemName(name).normalize('NFC').toLowerCase()
}

/** PostgREST embeds that bring in the name of the item a row belongs to (see the foreign keys in supabase/schema.sql). */
export const TRANSACTION_ITEM_JOIN = 'items!transactions_item_fk(name)'
export const RECURRING_ITEM_JOIN = 'items!recurring_item_fk(name)'

/** A row read with one of those joins becomes a plain record: `item` is the name and the join is dropped. */
export function withItemName<T extends { items?: { name: string } | null }>(row: T): Omit<T, 'items'> & { item: string } {
  const { items, ...rest } = row
  return { ...rest, item: items?.name ?? '' }
}
