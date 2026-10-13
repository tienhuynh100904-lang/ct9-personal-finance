'use client'

import { useSyncExternalStore } from 'react'

const LOCAL_EVENT = 'ct9:local-value'

function subscribe(onChange: () => void) {
  window.addEventListener(LOCAL_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(LOCAL_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * A localStorage value as React state: `undefined` on the server and while hydrating (so the
 * first render matches the server and nothing flashes), then the stored string, or `null`
 * when nothing is stored or storage is unavailable. Writes made in this
 * tab also notify subscribers (the browser only fires `storage` in the *other* tabs).
 */
export function useLocalValue(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => undefined,
  )
}

export function writeLocalValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // storage blocked: the value just won't persist
  }
  window.dispatchEvent(new Event(LOCAL_EVENT))
}
