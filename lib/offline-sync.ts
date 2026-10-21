/**
 * "Ghi offline": the pure parts shared by the server route (app/api/offline/transactions) and the
 * app shell. The queue itself lives in the browser (public/offline-db.js, public/sw.js); see
 * docs/ghi-offline.md for the whole flow.
 *
 * No server or DOM APIs here, so it runs under `node --test`.
 */
import { isUuid } from './actions/result.ts'
import type { Category, Kind } from './finance'
import type { ItemRecord, ItemUsage } from './types'

/** One item as the offline page offers it: newest-favourite first, with the category to pre-fill. */
export type OfflineItem = { id: string; kind: Kind; name: string; category: Category | null }

/** What the app hands the service worker while online, so the offline page has items to pick from. */
export type OfflineSnapshot = { userId: string; items: OfflineItem[] }

/**
 * The items of `userId` that can still be logged (hidden ones left out), most used first, then by
 * name. The category to pre-fill is the one used last time, else the item's default.
 */
export function buildOfflineSnapshot(userId: string, items: readonly ItemRecord[], usage: readonly ItemUsage[]): OfflineSnapshot {
  const byItem = new Map(usage.map((row) => [row.item_id, row]))
  const active = items
    .filter((item) => item.archived_at === null)
    .map((item) => {
      const used = byItem.get(item.id)
      return { item, uses: used?.uses ?? 0, category: used?.last_category ?? item.default_category }
    })
    .sort((a, b) => b.uses - a.uses || a.item.name.localeCompare(b.item.name, 'vi'))
  return {
    userId,
    items: active.map(({ item, category }) => ({ id: item.id, kind: item.kind, name: item.name, category })),
  }
}

export type QueuedEntry = {
  /** Made on the phone when the entry was saved; becomes the transaction's id, so a resend is not a second row. */
  id: string
  /** The account the entry was saved under (from the snapshot). */
  userId: string
  /** The transaction fields, checked afterwards by `validateTransaction`. */
  body: { kind: unknown; item_id: unknown; category: unknown; amount: unknown; occurred_on: unknown; note: unknown }
}

/** The envelope of one queued entry as the service worker posts it. Field values are checked later. */
export function parseQueuedEntry(raw: unknown): { ok: true; entry: QueuedEntry } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Dữ liệu không hợp lệ.' }
  const value = raw as Record<string, unknown>
  if (!isUuid(value.id)) return { ok: false, error: 'Mã khoản ghi không hợp lệ.' }
  if (!isUuid(value.user_id)) return { ok: false, error: 'Không rõ tài khoản của khoản ghi.' }
  return {
    ok: true,
    entry: {
      id: value.id.toLowerCase(),
      userId: value.user_id.toLowerCase(),
      body: {
        kind: value.kind,
        item_id: value.item_id,
        category: value.category,
        amount: value.amount,
        occurred_on: value.occurred_on,
        note: value.note ?? null,
      },
    },
  }
}

/**
 * Whether a cookie-authenticated POST came from this site's own pages or service worker. Server
 * Actions check this themselves; a route handler has to. `Sec-Fetch-Site` is trusted when the
 * browser sends it, otherwise `Origin` must name this host.
 */
export function isSameOriginRequest(headers: { origin: string | null; host: string | null; secFetchSite: string | null }): boolean {
  if (headers.secFetchSite) return headers.secFetchSite === 'same-origin'
  if (!headers.origin || !headers.host) return false
  try {
    return new URL(headers.origin).host === headers.host
  } catch {
    return false
  }
}
