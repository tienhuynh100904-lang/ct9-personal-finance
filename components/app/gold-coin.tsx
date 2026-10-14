import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/**
 * Gradients for every <GoldCoin> on the page. Rendered once (by the auth shell): coins reference
 * them by id, which also keeps working when a coin itself is hidden (e.g. reduced motion).
 */
export function CoinDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="ct9-coin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe68a" />
          <stop offset="0.45" stopColor="#eab01f" />
          <stop offset="1" stopColor="#a86c06" />
        </linearGradient>
        <radialGradient id="ct9-coin-face" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.42" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#e3a012" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/** A gold đồng coin: reeded rim, raised inner ring and an embossed ₫. Purely decorative. */
export function GoldCoin({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('block', className)} style={style} aria-hidden focusable="false">
      <circle cx="32" cy="32" r="31" fill="url(#ct9-coin-rim)" />
      <circle cx="32" cy="32" r="28.4" fill="none" stroke="#fff4c2" strokeOpacity="0.6" strokeWidth="1.6" strokeDasharray="1.4 2.2" />
      <circle cx="32" cy="32" r="25.6" fill="url(#ct9-coin-face)" />
      <circle cx="32" cy="32" r="21.6" fill="none" stroke="#9a6400" strokeOpacity="0.32" strokeWidth="1.2" />
      <text x="31.2" y="41.2" textAnchor="middle" fontSize="25" fontWeight="800" fill="#fff8dc" fillOpacity="0.75">
        ₫
      </text>
      <text x="32" y="42" textAnchor="middle" fontSize="25" fontWeight="800" fill="#9a6400">
        ₫
      </text>
      <path d="M13.5 25 A19.5 19.5 0 0 1 28 12.6" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/** Four-point twinkle used around the hero coin. */
export function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden focusable="false">
      <path d="M12 0C12.9 7 17 11.1 24 12 17 12.9 12.9 17 12 24 11.1 17 7 12.9 0 12 7 11.1 11.1 7 12 0Z" fill="currentColor" />
    </svg>
  )
}
