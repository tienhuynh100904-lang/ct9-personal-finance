/**
 * Theme preference. Light is the designed default; "system" follows the phone.
 * Stored in localStorage (never a cookie, so layouts stay statically prerenderable)
 * and applied before first paint by THEME_INIT_SCRIPT, which runs in <head>.
 */
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ct9-theme'
export const THEME_CHANGE_EVENT = 'ct9:theme'
/** Must match --bg in globals.css. Used for the browser / PWA status bar. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f6f6f3', dark: '#0d0d0d' }

/** Sets data-theme + data-theme-pref on <html> and updates theme-color. Never throws. */
export const THEME_INIT_SCRIPT = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)},c=${JSON.stringify(THEME_COLORS)},d=document.documentElement,p='light',m=null;try{p=localStorage.getItem(k)||'light'}catch(e){}if(p!=='dark'&&p!=='system')p='light';try{m=window.matchMedia('(prefers-color-scheme: dark)')}catch(e){}function a(){try{var t=(p==='dark'||(p==='system'&&m&&m.matches))?'dark':'light';d.setAttribute('data-theme',t);d.setAttribute('data-theme-pref',p);var s=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<s.length;i++)s[i].setAttribute('content',c[t])}catch(e){}}a();if(m&&m.addEventListener)m.addEventListener('change',function(){if(p==='system')a()});window.__ct9SetTheme=function(n){p=(n==='dark'||n==='system')?n:'light';a()}})()`

declare global {
  interface Window {
    __ct9SetTheme?: (pref: ThemePref) => void
  }
}

function isPref(value: unknown): value is ThemePref {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** The preference currently in effect (falls back to what the init script applied if storage is blocked). */
export function readThemePref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isPref(stored)) return stored
  } catch {
    // storage blocked: fall through to the attribute the init script set
  }
  const applied = document.documentElement.dataset.themePref
  return isPref(applied) ? applied : 'light'
}

export function setThemePref(pref: ThemePref): { persisted: boolean } {
  let persisted = true
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    persisted = false
  }
  if (window.__ct9SetTheme) window.__ct9SetTheme(pref)
  else document.documentElement.setAttribute('data-theme', pref === 'dark' ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme-pref', pref)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  return { persisted }
}

export function subscribeThemePref(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) onChange()
  }
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
