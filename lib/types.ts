import type { Category, Kind, Txn } from './finance'

export type TransactionRecord = Txn & { id: string; note: string | null; created_at: string }
export type ItemRecord = { id: string; kind: Kind; name: string; default_category: Category | null }
export type ItemUsage = { kind: Kind; item: string; uses: number; last_used_on: string; last_category: Category }
