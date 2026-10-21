import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CATEGORY_META } from '../lib/categories.ts'
import { buildOfflineSnapshot, isSameOriginRequest, parseQueuedEntry } from '../lib/offline-sync.ts'
import type { ItemRecord, ItemUsage } from '../lib/types.ts'

const ID = '0b7e3c1e-5d2a-4f6b-9c8d-1a2b3c4d5e6f'
const USER = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
const ITEM = '11111111-2222-4333-8444-555555555555'

const item = (id: string, name: string, extra: Partial<ItemRecord> = {}): ItemRecord => ({
  id,
  kind: 'expense',
  name,
  default_category: null,
  archived_at: null,
  ...extra,
})
const use = (item_id: string, uses: number, last_category: ItemUsage['last_category'] = null): ItemUsage => ({
  item_id,
  kind: 'expense',
  item: '',
  uses,
  last_used_on: null,
  last_category,
})

test('snapshot: hidden items are left out, most used first, then by name', () => {
  const snapshot = buildOfflineSnapshot(
    USER,
    [item('a', 'Ăn uống'), item('b', 'Cà phê'), item('c', 'Bánh mì'), item('d', 'Cũ', { archived_at: '2026-01-01' })],
    [use('b', 9), use('a', 2), use('d', 50)],
  )
  assert.equal(snapshot.userId, USER)
  assert.deepEqual(
    snapshot.items.map((i) => i.name),
    ['Cà phê', 'Ăn uống', 'Bánh mì'],
  )
})

test('snapshot: the category is the one used last time, else the default', () => {
  const snapshot = buildOfflineSnapshot(
    USER,
    [item('a', 'Ăn uống', { default_category: 'essential' }), item('b', 'Quà', { default_category: 'incidental' })],
    [use('a', 3, 'non_essential')],
  )
  assert.deepEqual(
    snapshot.items.map((i) => [i.name, i.category]),
    [
      ['Ăn uống', 'non_essential'],
      ['Quà', 'incidental'],
    ],
  )
})

test('queued entry: needs its own id and the account it was saved under', () => {
  const body = { kind: 'expense', item_id: ITEM, category: 'essential', amount: 50000, occurred_on: '2026-10-21', note: null }
  const ok = parseQueuedEntry({ id: ID.toUpperCase(), user_id: USER, ...body })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.entry.id, ID)
    assert.equal(ok.entry.userId, USER)
    assert.deepEqual(ok.entry.body, body)
  }
  assert.equal(parseQueuedEntry({ ...body, user_id: USER }).ok, false)
  assert.equal(parseQueuedEntry({ ...body, id: ID }).ok, false)
  assert.equal(parseQueuedEntry({ ...body, id: 'abc', user_id: USER }).ok, false)
  assert.equal(parseQueuedEntry(null).ok, false)
  assert.equal(parseQueuedEntry([ID]).ok, false)
})

test('queued entry: a missing note becomes null', () => {
  const parsed = parseQueuedEntry({ id: ID, user_id: USER, kind: 'expense', item_id: ITEM, category: 'essential', amount: 1, occurred_on: '2026-10-21' })
  assert.equal(parsed.ok && parsed.entry.body.note, null)
})

test('same-origin check: Sec-Fetch-Site wins, Origin must match the host otherwise', () => {
  const host = 'ct9-personal-finance.vercel.app'
  assert.equal(isSameOriginRequest({ secFetchSite: 'same-origin', origin: null, host }), true)
  assert.equal(isSameOriginRequest({ secFetchSite: 'cross-site', origin: `https://${host}`, host }), false)
  assert.equal(isSameOriginRequest({ secFetchSite: 'same-site', origin: `https://${host}`, host }), false)
  assert.equal(isSameOriginRequest({ secFetchSite: null, origin: `https://${host}`, host }), true)
  assert.equal(isSameOriginRequest({ secFetchSite: null, origin: 'https://evil.example', host }), false)
  assert.equal(isSameOriginRequest({ secFetchSite: null, origin: null, host }), false)
  assert.equal(isSameOriginRequest({ secFetchSite: null, origin: 'not a url', host }), false)
})

test('the offline page lists every category with the same code and label as the app', () => {
  const page = readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8')
  for (const [code, meta] of Object.entries(CATEGORY_META)) {
    assert.ok(page.includes(`['${code}', '${meta.label}']`), `offline.html is missing ['${code}', '${meta.label}']`)
  }
})

test('the service worker posts to the route that exists, and the proxy lets the offline files through', () => {
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.ok(worker.includes("'/api/offline/transactions'"))
  readFileSync(new URL('../app/api/offline/transactions/route.ts', import.meta.url), 'utf8')
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.ok(proxy.includes('offline.html') && proxy.includes('offline-db.js'))
})
