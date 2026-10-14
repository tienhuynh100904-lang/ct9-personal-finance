'use client'

import { BellRing, Smartphone, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ChoiceChips } from '@/components/ui/choice'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { removePushSubscription, savePushSubscription, saveReminderSettings } from '@/lib/actions/reminders'
import { readPushSupport, subscribeThisDevice } from '@/lib/push-client'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

const PRESETS = [
  { value: '07:00', label: 'Sáng 07:00' },
  { value: '12:00', label: 'Trưa 12:00' },
  { value: '18:00', label: 'Chiều 18:00' },
  { value: '21:00', label: 'Tối 21:00' },
] as const
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const value = String(h).padStart(2, '0')
  return { value, label: `${value} giờ` }
})
const MINUTES = ['00', '15', '30', '45'].map((value) => ({ value, label: `${value} phút` }))

const noopSubscribe = () => () => {}

/** Notification permission as external state, so a change made in the browser settings shows up. */
function subscribePermission(onChange: () => void) {
  let status: PermissionStatus | null = null
  let active = true
  navigator.permissions
    ?.query({ name: 'notifications' })
    .then((result) => {
      if (!active) return
      status = result
      result.addEventListener('change', onChange)
    })
    .catch(() => {})
  return () => {
    active = false
    status?.removeEventListener('change', onChange)
  }
}
const readPermission = (): NotificationPermission => ('Notification' in window ? Notification.permission : 'denied')

export function ReminderSettings({ initial }: { initial: { enabled: boolean; remindAt: string } }) {
  const support = useSyncExternalStore(noopSubscribe, readPushSupport, () => 'checking' as const)
  const permission = useSyncExternalStore(subscribePermission, readPermission, () => 'default' as const)
  const labelId = useId()

  const [enabled, setEnabled] = useState(initial.enabled)
  const [remindAt, setRemindAt] = useState(initial.remindAt)
  const [customOpen, setCustomOpen] = useState(false)
  /** Does this browser already have a push subscription? `null` until checked. */
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (support !== 'ok') return
    let cancelled = false
    void navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setDeviceOn(Boolean(subscription))
      })
      .catch(() => {
        if (!cancelled) setDeviceOn(false)
      })
    return () => {
      cancelled = true
    }
  }, [support])

  /** Asks permission, subscribes this browser and tells the server about it. */
  async function enableThisDevice(): Promise<boolean> {
    if (!PUBLIC_KEY) {
      toast.error('Chưa cấu hình khoá thông báo', { description: 'Xem docs/nhac-ghi-chep.md.' })
      return false
    }
    try {
      // Ask first, straight from the tap: some browsers only allow the prompt right after a gesture.
      const answer = permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (answer !== 'granted') {
        toast.error('Chưa được cấp quyền thông báo', {
          description: 'Hãy cho phép thông báo của trang này trong cài đặt trình duyệt rồi thử lại.',
        })
        return false
      }
      const subscription = await subscribeThisDevice(PUBLIC_KEY)
      const json = subscription.toJSON()
      const saved = await runAction(() =>
        savePushSubscription({
          endpoint: json.endpoint ?? subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
          userAgent: navigator.userAgent,
        }),
      )
      if (!saved) return false
      if (!saved.ok) {
        toast.error(saved.error)
        return false
      }
      setDeviceOn(true)
      return true
    } catch (error) {
      console.error('enable push failed', error)
      toast.error('Không bật được thông báo trên thiết bị này', { description: 'Vui lòng thử lại.' })
      return false
    }
  }

  async function persist(next: { enabled: boolean; remindAt: string }): Promise<boolean> {
    const result = await runAction(() => saveReminderSettings(next))
    if (!result) return false
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    return true
  }

  async function toggle(next: boolean) {
    setBusy(true)
    try {
      if (next && !deviceOn && !(await enableThisDevice())) return
      if (!(await persist({ enabled: next, remindAt }))) return
      setEnabled(next)
      if (next) toast.success('Đã bật nhắc ghi chép', { description: `Mỗi ngày lúc ${remindAt}, nếu hôm đó bạn chưa ghi gì.` })
      else toast.success('Đã tắt nhắc ghi chép')
    } finally {
      setBusy(false)
    }
  }

  async function changeTime(next: string) {
    if (next === remindAt) return
    const previous = remindAt
    setRemindAt(next)
    setBusy(true)
    try {
      if (await persist({ enabled, remindAt: next })) toast.success(`Giờ nhắc: ${next}`)
      else setRemindAt(previous)
    } finally {
      setBusy(false)
    }
  }

  async function addThisDevice() {
    setBusy(true)
    try {
      if (await enableThisDevice()) toast.success('Đã bật thông báo trên thiết bị này')
    } finally {
      setBusy(false)
    }
  }

  async function forgetThisDevice() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await runAction(() => removePushSubscription(endpoint))
      }
      setDeviceOn(false)
      toast.success('Đã gỡ thiết bị này')
    } finally {
      setBusy(false)
    }
  }

  const isPreset = PRESETS.some((p) => p.value === remindAt)
  const [hour, minute] = remindAt.split(':')
  const blocked = permission === 'denied' && deviceOn === false

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
            <BellRing className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p id={labelId} className="font-medium">
              Nhắc ghi chép mỗi ngày
            </p>
            <p className="text-sm text-muted">
              Một thông báo mỗi ngày lúc <span className="font-medium tabular-nums text-ink-2">{remindAt}</span>, chỉ khi hôm đó bạn chưa ghi gì.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => void toggle(next)}
          disabled={busy || support === 'checking' || support === 'unsupported' || support === 'needs-install' || (blocked && !enabled)}
          aria-labelledby={labelId}
        />
      </div>

      {support === 'unsupported' ? (
        <Notice>Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome trên Android hoặc máy tính.</Notice>
      ) : null}
      {support === 'needs-install' ? (
        <Notice>
          Trên iPhone, hãy bấm nút Chia sẻ → <strong>Thêm vào Màn hình chính</strong>, rồi mở app từ biểu tượng mới và bật nhắc ở đây.
        </Notice>
      ) : null}
      {support === 'ok' && !PUBLIC_KEY ? <Notice>Chưa cấu hình khoá thông báo trên máy chủ (xem docs/nhac-ghi-chep.md).</Notice> : null}
      {blocked ? (
        <Notice>
          Thông báo đang bị chặn cho trang này. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → Thông báo → <strong>Cho phép</strong>, rồi bật lại.
        </Notice>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-2">Giờ nhắc</p>
        <ChoiceChips
          label="Giờ nhắc"
          value={customOpen || !isPreset ? 'other' : remindAt}
          onChange={(value) => {
            if (value === 'other') setCustomOpen(true)
            else {
              setCustomOpen(false)
              void changeTime(value)
            }
          }}
          options={[...PRESETS, { value: 'other', label: 'Giờ khác' }]}
        />
        {customOpen || !isPreset ? (
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
            <Select label="Giờ" value={hour} onValueChange={(h) => void changeTime(`${h}:${minute}`)} options={HOURS} triggerClassName="h-10" />
            <Select label="Phút" value={minute} onValueChange={(m) => void changeTime(`${hour}:${m}`)} options={MINUTES} triggerClassName="h-10" />
          </div>
        ) : null}
      </div>

      {enabled && deviceOn === false && support === 'ok' && !blocked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="flex min-w-0 items-center gap-2">
            <Smartphone className="size-4 shrink-0 text-muted" aria-hidden />
            Thiết bị này chưa nhận được thông báo.
          </p>
          <Button size="sm" variant="secondary" onClick={() => void addThisDevice()} disabled={busy}>
            Bật trên thiết bị này
          </Button>
        </div>
      ) : null}

      {deviceOn ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={() => void forgetThisDevice()} disabled={busy}>
            Gỡ thiết bị này
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex gap-2.5 rounded-xl bg-surface-2 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>{children}</p>
    </div>
  )
}
