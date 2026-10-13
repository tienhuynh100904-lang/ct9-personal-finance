'use client'

import { X } from 'lucide-react'
import { DialogToaster } from './toaster'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to
 * close, top-layer rendering). Bottom sheet on phones, centered from `sm` up.
 * Compose the content with <DialogBody> (scrolls) and <DialogFooter> (stays put,
 * so the primary action is never hidden behind the keyboard).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const onCloseRef = useRef(onClose)
  // A drag that starts inside a field and ends over the backdrop must not close the dialog.
  const pressStartedOnBackdrop = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // When the page is hidden by a navigation (Next.js keeps it mounted), close the dialog too.
  useLayoutEffect(() => {
    const dialog = ref.current
    return () => {
      if (dialog?.open) {
        dialog.close()
        onCloseRef.current()
      }
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="app-dialog"
      onClose={() => onCloseRef.current()}
      onPointerDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget && pressStartedOnBackdrop.current) event.currentTarget.close()
        pressStartedOnBackdrop.current = false
      }}
    >
      <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong sm:hidden" />
      <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-3 pb-2 sm:pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-0.5 text-sm text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink active:bg-surface-2"
          aria-label="Đóng"
        >
          <X className="size-5" />
        </button>
      </div>
      {children}
      {open ? <DialogToaster /> : null}
    </dialog>
  )
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 ${className ?? ''}`}>{children}</div>
  )
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
