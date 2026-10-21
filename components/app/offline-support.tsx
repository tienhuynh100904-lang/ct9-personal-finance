'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { OfflineSnapshot } from '@/lib/offline-sync'
import { toast } from '@/lib/toast'

/**
 * "Ghi offline", the in-app side (see docs/ghi-offline.md). While the app is open and online it:
 * registers the service worker, hands it the item list so the offline page can offer it, and asks
 * it to send anything saved offline. When entries reach the server it says so and reloads the data.
 * Renders nothing.
 */
export function OfflineSupport({ snapshot }: { snapshot: OfflineSnapshot }) {
  const router = useRouter()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // The worker also sends whatever waits in the queue once it has the snapshot.
        if (!cancelled) registration.active?.postMessage({ type: 'ct9-snapshot', snapshot })
      })
      .catch((error: unknown) => console.error('offline support unavailable', error))
    return () => {
      cancelled = true
    }
  }, [snapshot])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; sent?: number } | null
      if (data?.type !== 'ct9-sync' || !data.sent) return
      toast.success(`Đã gửi ${data.sent} khoản ghi lúc mất mạng`, { description: 'Số liệu đã được cập nhật.' })
      router.refresh()
    }
    const onOnline = () => navigator.serviceWorker.controller?.postMessage({ type: 'ct9-flush' })
    navigator.serviceWorker.addEventListener('message', onMessage)
    window.addEventListener('online', onOnline)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
      window.removeEventListener('online', onOnline)
    }
  }, [router])

  return null
}
