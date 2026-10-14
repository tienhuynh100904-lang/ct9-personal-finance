import type { ReactNode } from 'react'
import { GoldCoin } from './gold-coin'

/** Busy indicator for the auth buttons: a coin spinning edge-on, fast. */
export function CoinSpinner() {
  return <GoldCoin className="coin-flip-loop size-5" style={{ animationDuration: '0.6s' }} />
}

/** Error banner on the auth cards. It shakes in, so a failed attempt is noticed. */
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="auth-shake rounded-xl bg-negative/10 px-3 py-2.5 text-sm font-medium text-negative">
      {children}
    </p>
  )
}

/** A leading icon inside a text field; give the input `pl-10`. */
export function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted [&>svg]:size-4">{children}</span>
}
