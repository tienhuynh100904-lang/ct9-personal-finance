'use client'

import { Check, MonitorSmartphone, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { readThemePref, setThemePref, subscribeThemePref, type ThemePref } from '@/lib/theme'

const OPTIONS: { value: ThemePref; label: string; caption: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Sáng', caption: 'Mặc định', Icon: Sun },
  { value: 'dark', label: 'Tối', caption: 'Dịu mắt ban đêm', Icon: Moon },
  { value: 'system', label: 'Theo thiết bị', caption: '', Icon: MonitorSmartphone },
]

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Mini app drawn with the real tokens of the theme it previews. */
function Preview({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div data-theme={theme} className="h-full bg-bg p-1.5">
      <div className="h-5 rounded-md border border-line [background:var(--hero-bg)]" />
      <div className="mt-1.5 space-y-1">
        <div className="h-2 rounded bg-surface-3" />
        <div className="h-2 w-3/4 rounded bg-surface-3" />
      </div>
      <div className="mt-1.5 flex justify-end">
        <div className="size-3 rounded-full bg-brand" />
      </div>
    </div>
  )
}

export function ThemePicker() {
  // null on the server and during hydration, so nothing is wrongly shown as selected.
  const pref = useSyncExternalStore(subscribeThemePref, readThemePref, () => null)
  const systemIsDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(DARK_QUERY).matches,
    () => null,
  )
  const [persisted, setPersisted] = useState(true)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function choose(value: ThemePref) {
    setPersisted(setThemePref(value).persisted)
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + OPTIONS.length) % OPTIONS.length
    choose(OPTIONS[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Chế độ giao diện" className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
        {OPTIONS.map(({ value, label, caption, Icon }, index) => {
          const selected = pref === value
          const tabbable = selected || (pref === null && index === 0)
          const text = value === 'system' ? (systemIsDark === null ? '' : `Đang: ${systemIsDark ? 'Tối' : 'Sáng'}`) : caption
          return (
            <button
              key={value}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => choose(value)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className="group block min-w-0 rounded-2xl text-left"
            >
              <span
                className={cn(
                  'relative block aspect-[4/3] overflow-hidden rounded-xl border transition-shadow',
                  selected ? 'border-brand-ink ring-2 ring-brand-ink ring-offset-2 ring-offset-surface' : 'border-line group-hover:border-line-strong',
                )}
              >
                {value === 'system' ? (
                  <>
                    <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
                      <Preview theme="light" />
                    </span>
                    <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
                      <Preview theme="dark" />
                    </span>
                  </>
                ) : (
                  <Preview theme={value} />
                )}
                {selected ? (
                  <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-brand text-on-brand">
                    <Check className="icon-pop size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : null}
              </span>
              <span className="mt-2 flex items-start gap-1.5 text-sm leading-tight">
                <Icon
                  className={cn(
                    'mt-px size-4 shrink-0 text-ink-2',
                    selected && (value === 'light' ? 'icon-spin-slow' : value === 'dark' ? 'icon-sway' : 'icon-beat'),
                  )}
                  aria-hidden
                />
                <span className={cn('min-w-0', selected ? 'font-semibold' : 'font-medium')}>{label}</span>
              </span>
              <span className="mt-0.5 block min-h-4 text-xs text-muted">{text}</span>
            </button>
          )
        })}
      </div>
      {persisted ? null : (
        <p role="status" className="mt-3 text-xs text-warning">
          Không lưu được lựa chọn trên trình duyệt này. Giao diện chỉ áp dụng đến khi tải lại trang.
        </p>
      )}
    </div>
  )
}
