/*
 * Service worker, registered by the app on every visit (components/app/offline-support.tsx) and by
 * Cài đặt → Nhắc ghi chép. Two jobs:
 *
 * 1. The daily "ghi chép" reminder (Web Push): shows the notification, opens the app when tapped.
 *    See docs/nhac-ghi-chep.md.
 * 2. "Ghi offline": when a page cannot be loaded because there is no network, it answers with the
 *    offline page (public/offline.html), and it sends what was saved there to the server once the
 *    network is back. See docs/ghi-offline.md.
 *
 * It caches only the offline page and its script, never the app's pages or data.
 */
try {
  importScripts('/offline-db.js')
} catch (error) {
  // Without the store, offline entry is unavailable; push reminders still work.
  console.error('offline store unavailable', error)
}

// Bump when the offline page changes shape; its content is also refreshed whenever the app is open.
const OFFLINE_CACHE = 'ct9-offline-v2'
const OFFLINE_URL = '/offline.html'
const OFFLINE_FILES = [OFFLINE_URL, '/offline-db.js', '/icon.svg']
const SYNC_TAG = 'ct9-flush'
const SYNC_URL = '/api/offline/transactions'

/** Fetches the offline files again, bypassing the HTTP cache. One failure does not stop the others. */
async function refreshOfflineFiles() {
  const cache = await caches.open(OFFLINE_CACHE)
  await Promise.all(
    OFFLINE_FILES.map((url) =>
      fetch(url, { cache: 'reload' })
        .then((response) => (response.ok ? cache.put(url, response) : undefined))
        .catch(() => undefined),
    ),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(refreshOfflineFiles().finally(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('ct9-offline-') && name !== OFFLINE_CACHE).map((name) => caches.delete(name)))
      // Lets the page request start while the worker boots, so pages do not load slower because of it.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      await self.clients.claim()
    })(),
  )
})

// ---- Offline page ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // The offline page's own script and icon: from the network when possible, else the stored copy.
  if (request.mode !== 'navigate') {
    if (OFFLINE_FILES.includes(url.pathname)) {
      event.respondWith(fetch(request).catch(async () => (await caches.match(url.pathname)) || Response.error()))
    }
    return
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Network first, always: the offline page is only the answer when the page could not be fetched at all.
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse
        if (preloaded) return preloaded
        return await fetch(request)
      } catch {
        const cached = await caches.match(OFFLINE_URL, { ignoreSearch: true })
        return cached || Response.error()
      }
    })(),
  )
})

// ---- Sending what was saved offline ---------------------------------------------------------

let flushing = null

/** One send at a time: a sync event and a message from the page can arrive together. */
function flushQueue() {
  if (!flushing) flushing = sendQueue().finally(() => (flushing = null))
  return flushing
}

async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) client.postMessage(message)
  return windows
}

/**
 * Sends the pending entries oldest first. Stops at the first sign that trying again later is the
 * only option (no network, server error, signed out); an entry the server refuses for good is kept
 * with the reason so the user can see it and delete it. Rejects when a later retry is worthwhile,
 * which makes the browser schedule the background sync again.
 */
async function sendQueue() {
  if (!self.CT9Offline) return { sent: 0, remaining: 0, needsLogin: false }
  const entries = await self.CT9Offline.listQueue()
  let sent = 0
  let needsLogin = false
  let retryLater = false

  for (const entry of entries) {
    if (entry.status !== 'pending') continue
    let response
    try {
      response = await fetch(SYNC_URL, {
        method: 'POST',
        credentials: 'same-origin',
        // Signed out, the proxy answers with a redirect to /login: see it as such instead of following it.
        redirect: 'manual',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          user_id: entry.user_id,
          kind: entry.kind,
          item_id: entry.item_id,
          category: entry.category,
          amount: entry.amount,
          occurred_on: entry.occurred_on,
          note: entry.note,
        }),
      })
    } catch {
      retryLater = true
      break
    }

    if (response.ok) {
      await self.CT9Offline.removeEntry(entry.id)
      sent += 1
      continue
    }
    if (response.type === 'opaqueredirect' || response.status === 401) {
      needsLogin = true
      break
    }
    if (response.status >= 500) {
      retryLater = true
      break
    }
    const body = await response.json().catch(() => ({}))
    await self.CT9Offline.putEntry({
      ...entry,
      status: response.status === 409 ? 'other_account' : 'failed',
      error: body.message || 'Máy chủ không nhận khoản này.',
    })
  }

  const remaining = (await self.CT9Offline.listQueue()).filter((entry) => entry.status === 'pending').length
  await self.CT9Offline.setMeta('sync', { needsLogin, lastTriedAt: new Date().toISOString() })
  const windows = await broadcast({ type: 'ct9-sync', sent, remaining, needsLogin })

  // Sent in the background with the app closed: say so, if notifications are allowed.
  const canNotify = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (sent > 0 && windows.length === 0 && canNotify) {
    await self.registration.showNotification('CT9 Finance', {
      body: `Đã gửi ${sent} khoản ghi lúc mất mạng.`,
      icon: '/apple-icon',
      tag: 'ct9-offline-sync',
      data: { url: '/transactions' },
    })
  }

  if (retryLater) throw new Error('offline queue: will retry')
  return { sent, remaining, needsLogin }
}

// Background Sync (Chrome on Android): fires when the network is back, even with the app closed.
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushQueue())
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'ct9-flush') {
    event.waitUntil(flushQueue().catch(() => undefined))
  } else if (data.type === 'ct9-snapshot' && self.CT9Offline && data.snapshot) {
    // The app is open and online: keep its item list for the offline page, refresh that page, send what waits.
    event.waitUntil(
      self.CT9Offline.setMeta('snapshot', { ...data.snapshot, savedAt: new Date().toISOString() })
        .then(() => refreshOfflineFiles())
        .then(() => flushQueue())
        .catch(() => undefined),
    )
  } else if (data.type === 'ct9-forget' && self.CT9Offline) {
    // Signed out: forget the item names. Entries still waiting are kept (the server checks their account).
    event.waitUntil(self.CT9Offline.deleteMeta('snapshot').catch(() => undefined))
  }
})

// ---- Daily reminder (Web Push) --------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CT9 Finance', {
      body: data.body || '',
      icon: '/apple-icon',
      // One reminder at a time: a new one replaces an unread one instead of piling up.
      tag: 'ct9-daily-reminder',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) return open.navigate(target)
        return undefined
      }
      return self.clients.openWindow(target)
    }),
  )
})
