'use client'

import { CircleAlert, CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'error'
type ToastItem = { id: number; message: string; tone: Tone }

const TOAST_EVENT = 'app:toast'
let nextId = 1

/** Shows a short confirmation at the bottom of the screen. Callable from any client code. */
export function toast(message: string, tone: Tone = 'success') {
  window.dispatchEvent(new CustomEvent<Omit<ToastItem, 'id'>>(TOAST_EVENT, { detail: { message, tone } }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(event: Event) {
      const { message, tone } = (event as CustomEvent<Omit<ToastItem, 'id'>>).detail
      const id = nextId++
      setItems((current) => [...current.slice(-2), { id, message, tone }])
      window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-lg',
            'animate-[toast-in_200ms_ease-out]',
          )}
        >
          {item.tone === 'error' ? (
            <CircleAlert className="size-4 shrink-0 text-[#f07070]" aria-hidden />
          ) : (
            <CircleCheck className="size-4 shrink-0 text-[#3fbf5f]" aria-hidden />
          )}
          {item.message}
        </div>
      ))}
    </div>
  )
}
