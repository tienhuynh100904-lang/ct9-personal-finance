'use client'

import { useLayoutEffect } from 'react'
import { readThemePref, subscribeThemePref } from '@/lib/theme'

/**
 * Re-applies the saved theme after React remounts (Strict Mode in dev strips attributes
 * from <html>) and when the preference changes in another tab.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const apply = () => window.__ct9SetTheme?.(readThemePref())
    apply()
    return subscribeThemePref(apply)
  }, [])
  return null
}
