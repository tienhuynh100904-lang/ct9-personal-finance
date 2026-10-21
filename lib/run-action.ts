'use client'

import { toast } from '@/lib/toast'

/**
 * Runs a Server Action call and turns a thrown error (no network, server down) into an error
 * toast instead of an unhandled rejection. Returns `null` when the call itself failed; a normal
 * `{ ok: false }` result is still returned for the caller to show. With `experimental.useOffline` a
 * dropped connection no longer throws: the call waits and runs once the network is back (see
 * <OfflineBanner>), so this catch is for the server being down or an unexpected error.
 */
export async function runAction<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call()
  } catch (error) {
    console.error('action failed', error)
    toast.error('Không kết nối được máy chủ', { description: 'Kiểm tra mạng rồi thử lại.' })
    return null
  }
}
