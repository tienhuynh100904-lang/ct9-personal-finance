'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/toast'

/** Raises an error toast when the page opens. For errors the server sent in the URL (a server component cannot toast). */
export function ErrorToastOnMount({ message }: { message: string }) {
  useEffect(() => {
    toast.error(message)
  }, [message])
  return null
}
