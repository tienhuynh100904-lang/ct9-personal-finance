/** Browser-side helpers for Web Push (used by the reminder settings; nothing here runs on the server). */

/** The VAPID public key as the byte array `pushManager.subscribe` wants. */
export function vapidKeyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const raw = window.atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export type PushSupport = 'checking' | 'ok' | 'unsupported' | 'needs-install'

/**
 * Can this browser receive push? iPhones only can once the app is on the Home Screen
 * ("needs-install"); everything else without the APIs is simply unsupported.
 */
export function readPushSupport(): PushSupport {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (apple && !standalone && !('PushManager' in window)) return 'needs-install'
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported'
}

export async function registerPushWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  return navigator.serviceWorker.ready
}

/** Subscribes this browser (or returns the existing subscription). Permission must already be granted. */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
  const registration = await registerPushWorker()
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing
  try {
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(publicKey) })
  } catch (error) {
    // A leftover subscription made with an older key blocks a new one: drop it and retry once.
    if (error instanceof DOMException && error.name === 'InvalidStateError') {
      await (await registration.pushManager.getSubscription())?.unsubscribe()
      return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(publicKey) })
    }
    throw error
  }
}
