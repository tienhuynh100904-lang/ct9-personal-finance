'use client'

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** The page's toaster. Toasts raised while a modal dialog is open go to the dialog's own toaster. */
export const DIALOG_TOASTER_ID = 'dialog'

function Base(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      visibleToasts={3}
      gap={10}
      closeButton
      toastOptions={{ closeButtonAriaLabel: 'Đóng thông báo' }}
      containerAriaLabel="Thông báo"
      offset={{ top: 'calc(var(--header-h) + 0.75rem)', right: 20 }}
      mobileOffset={{ top: 'calc(var(--header-h) + 0.5rem)', right: 12, left: 12 }}
      icons={{
        success: <CircleCheck />,
        error: <CircleAlert />,
        info: <Info />,
        warning: <TriangleAlert />,
        close: <X className="size-4" />,
      }}
      {...props}
    />
  )
}

export function AppToaster() {
  return <Base />
}

/**
 * A modal <dialog> makes the rest of the page inert, so a toast on <body> could not be seen or
 * clicked. <Dialog> renders this inside itself while open.
 */
export function DialogToaster() {
  return <Base id={DIALOG_TOASTER_ID} />
}
