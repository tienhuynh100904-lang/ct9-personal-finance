'use client'

import type { ReactNode } from 'react'
import { Button } from './button'
import { Dialog, DialogFooter } from './dialog'

/**
 * Replaces `window.confirm`: a small sheet (phones) or card (desktop) in the app's style. The safe
 * choice ("Ở lại") has the initial focus; Esc, the close button and a tap outside all cancel.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Ở lại',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <DialogFooter>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" compact data-autofocus="" onClick={onCancel} className="min-w-0">
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} size="lg" compact onClick={onConfirm} className="min-w-0">
            {confirmLabel}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
