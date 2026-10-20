import type { Category, Kind } from './finance'
import type { TransactionRecord } from './types'

export type EditableTransaction = Pick<
  TransactionRecord,
  'id' | 'kind' | 'item_id' | 'item' | 'category' | 'amount' | 'occurred_on' | 'note' | 'from_savings'
>

/** A one-tap starting point: item (by id), category and (usually) the last amount used. */
export type ComposerPreset = { item_id: string; category: Category; amount?: number }

export type ComposerRequest = {
  kind?: Kind
  transaction?: EditableTransaction
  /** Date to record against (`YYYY-MM-DD`), e.g. yesterday when backfilling. Defaults to today. */
  date?: string
  preset?: ComposerPreset
}

const COMPOSER_EVENT = 'app:composer'
let pendingRequest: ComposerRequest | null = null

/**
 * Opens the add/edit transaction dialog from anywhere in the app. The dialog
 * lives in the app layout; if it hasn't mounted yet the request is replayed.
 */
export function openComposer(request: ComposerRequest = {}) {
  pendingRequest = request
  window.dispatchEvent(new CustomEvent<ComposerRequest>(COMPOSER_EVENT, { detail: request }))
}

export function subscribeComposer(handler: (request: ComposerRequest) => void): () => void {
  if (pendingRequest) {
    handler(pendingRequest)
    pendingRequest = null
  }
  const listener = (event: Event) => {
    pendingRequest = null
    handler((event as CustomEvent<ComposerRequest>).detail)
  }
  window.addEventListener(COMPOSER_EVENT, listener)
  return () => window.removeEventListener(COMPOSER_EVENT, listener)
}
