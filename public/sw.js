/*
 * Service worker for the daily "ghi chép" reminder (Web Push). It only shows notifications and
 * opens the app when one is tapped; it caches nothing. Registered from Cài đặt → Nhắc ghi chép.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

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
