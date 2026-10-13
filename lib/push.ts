import 'server-only'

import webpush from 'web-push'

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string }
export type PushPayload = { title: string; body: string; url: string }

export type PushResult = {
  sent: number
  /** Ids of subscriptions the push service says no longer exist (app removed, permission revoked). */
  gone: string[]
  failed: number
}

/** A reminder is only useful for a few hours; after that the push service may drop it. */
const TTL_SECONDS = 4 * 60 * 60

/** True when the three VAPID settings are present. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  )
}

let configured = false

function configure() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Thiếu khoá thông báo: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (xem docs/nhac-ghi-chep.md).')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/** Sends one notification to each device. Never throws for a single bad device. */
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<PushResult> {
  configure()
  const body = JSON.stringify(payload)
  const result: PushResult = { sent: 0, gone: [], failed: 0 }

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          body,
          { TTL: TTL_SECONDS, urgency: 'normal' },
        )
        result.sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) result.gone.push(target.id)
        else {
          result.failed += 1
          console.error('push failed', status ?? error)
        }
      }
    }),
  )
  return result
}
