'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to
 * close, top-layer rendering). Bottom sheet on phones, centered from `sm` up.
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
  const onCloseRef = useRef(onClose)

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
      className="app-dialog"
      onClose={() => onCloseRef.current()}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  )
}
