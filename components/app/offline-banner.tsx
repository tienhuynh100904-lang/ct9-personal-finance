'use client'

import { WifiOff } from 'lucide-react'
import { useOffline } from 'next/offline'

/**
 * Shown while the connection is down (needs `experimental.useOffline` in next.config.ts). Next.js holds
 * a save or a page change made in the meantime and runs it once when the network is back, so the
 * message says it will be sent rather than that it failed.
 */
export function OfflineBanner() {
  const offline = useOffline()
  if (!offline) return null

  return (
    <div
      role="status"
      className="rise-in pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex justify-center px-4"
    >
      <p className="flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--s-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-warning)_14%,var(--surface))] px-4 py-2 text-sm font-medium text-ink shadow-[var(--shadow-1)]">
        <WifiOff className="size-4 shrink-0 text-warning" aria-hidden />
        Đang mất mạng · sẽ tự gửi khi có mạng
      </p>
    </div>
  )
}
