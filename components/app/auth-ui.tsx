import type { ReactNode } from 'react'
import { GoldCoin } from './gold-coin'

/** Busy indicator for the auth buttons: a coin spinning edge-on, fast. */
export function CoinSpinner() {
  return <GoldCoin className="coin-flip-loop size-5" style={{ animationDuration: '0.6s' }} />
}

/** A leading icon inside a text field; give the input `pl-10`. */
export function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted [&>svg]:size-4">{children}</span>
}
