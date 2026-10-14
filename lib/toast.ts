import { toast as sonner, type ExternalToast } from 'sonner'
import { DIALOG_TOASTER_ID } from '@/components/ui/toaster'

type Options = Omit<ExternalToast, 'toasterId'>
type Kind = 'success' | 'error' | 'info' | 'warning'

function show(kind: Kind, message: string, options: Options = {}) {
  // While a modal dialog is open the page behind it is inert; show the toast inside the dialog.
  const inDialog = document.querySelector('dialog[open]') !== null
  const description = typeof options.description === 'string' ? options.description : ''
  return sonner[kind](message, {
    // The same message again replaces the toast on screen instead of stacking a copy.
    id: options.action ? undefined : `${kind}|${message}|${description}`,
    // Errors, warnings and actionable toasts (e.g. "Hoàn tác") stay longer.
    duration: kind === 'error' || kind === 'warning' ? 7000 : options.action ? 8000 : 4500,
    ...options,
    toasterId: inDialog ? DIALOG_TOASTER_ID : undefined,
  })
}

/** Notifications in the top-right corner, backed by sonner. Callable from any client code. */
export const toast = {
  success: (message: string, options?: Options) => show('success', message, options),
  error: (message: string, options?: Options) => show('error', message, options),
  info: (message: string, options?: Options) => show('info', message, options),
  warning: (message: string, options?: Options) => show('warning', message, options),
}
