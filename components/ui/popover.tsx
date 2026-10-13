'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/cn'
import { Dialog, DialogBody } from './dialog'

const NARROW_QUERY = '(max-width: 639px)'

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Phones get a bottom sheet instead of a floating panel. `false` on the server and while hydrating. */
function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW_QUERY).matches, () => false)
}

export type PopoverTriggerProps = {
  ref: Ref<HTMLButtonElement>
  onClick: () => void
  'aria-haspopup': 'dialog'
  'aria-expanded': boolean
  'aria-controls': string
}

type Placement = { up: boolean; end: boolean }

/**
 * A button-triggered panel: a floating box on tablets and desktops (flips upward or to the
 * right edge when there is no room) and a bottom sheet on phones. Closes on Esc, on a press
 * outside, and returns focus to the trigger.
 */
export function Popover({
  label,
  trigger,
  children,
  panelWidth = 288,
  panelHeight = 320,
  className,
  panelClassName,
}: {
  /** Names the panel for screen readers and titles the phone sheet. */
  label: string
  trigger: (props: PopoverTriggerProps & { open: boolean }) => ReactNode
  children: (close: () => void) => ReactNode
  /** Expected size, used to decide whether to open upward / right-aligned. */
  panelWidth?: number
  panelHeight?: number
  className?: string
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement>({ up: false, end: false })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const narrow = useIsNarrow()

  // Bumped when the panel is closed on purpose (pick, Esc), so focus can go back to the trigger.
  // Closing by pressing elsewhere must not pull focus away from what the user just clicked.
  const [focusBack, setFocusBack] = useState(0)
  const close = useCallback(() => {
    setOpen(false)
    setFocusBack((n) => n + 1)
  }, [])

  useEffect(() => {
    if (focusBack > 0) triggerRef.current?.focus()
  }, [focusBack])

  function toggle() {
    if (open) return close()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setPlacement({
        up: below < panelHeight + 16 && rect.top > below,
        end: rect.left + panelWidth > window.innerWidth - 8,
      })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open || narrow) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, narrow, close])

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: toggle,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': panelId,
        open,
      })}

      {open && !narrow ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute z-50 max-h-[min(22rem,70vh)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface shadow-[var(--shadow-2)]',
            placement.up ? 'bottom-full mb-2' : 'top-full mt-2',
            placement.end ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}

      {open && narrow ? (
        <Dialog open onClose={() => setOpen(false)} title={label}>
          <DialogBody className="pt-1">{children(close)}</DialogBody>
        </Dialog>
      ) : null}
    </div>
  )
}
