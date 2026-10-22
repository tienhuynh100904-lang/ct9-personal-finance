import type { CSSProperties, ReactNode } from 'react'
import { CoinDefs, GoldCoin, Sparkle } from './gold-coin'
import { LogoMark } from './logo'

/** Coins drifting down behind the page: left edge, size (px), fall time, start offset, sideways drift, far (blurred). */
const FALLING_COINS: { left: string; size: number; dur: number; delay: number; drift: number; far?: boolean }[] = [
  { left: '4%', size: 26, dur: 15, delay: -2, drift: 30 },
  { left: '14%', size: 16, dur: 19, delay: -11, drift: -20, far: true },
  { left: '27%', size: 34, dur: 17, delay: -7, drift: 40 },
  { left: '41%', size: 14, dur: 22, delay: -15, drift: 16, far: true },
  { left: '56%', size: 22, dur: 16, delay: -4, drift: -36 },
  { left: '68%', size: 18, dur: 21, delay: -18, drift: 24, far: true },
  { left: '79%', size: 30, dur: 18, delay: -9, drift: -28 },
  { left: '91%', size: 20, dur: 20, delay: -13, drift: 18 },
]

/**
 * The shell shared by the signed-out pages (login, forgot and reset password): an animated gold
 * backdrop, the brand hero with a flipping coin, and a glass card holding the form.
 * Phones show a compact hero above the card; from `lg` the hero becomes a left column with the pitch.
 * All motion is CSS (see "Auth shell" in globals.css) and stops under prefers-reduced-motion.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <CoinDefs />
      <AuthBackdrop />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl content-center items-center gap-7 px-4 py-8 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10">
        <section className="auth-rise flex flex-col items-center text-center lg:items-start lg:text-left">
          <CoinStage />
          <div className="mt-5 flex items-center gap-3 lg:mt-7 lg:gap-4">
            <LogoMark className="size-11 lg:size-16" />
            <h1 className="auth-title text-3xl font-bold tracking-tight lg:text-5xl">CT9 Finance</h1>
          </div>
          <p className="mt-1.5 text-sm text-ink-2 lg:text-base">{subtitle}</p>

          <div className="hidden w-full max-w-md lg:block">
            <p className="mt-6 text-2xl leading-snug font-semibold tracking-tight text-balance text-ink">
              Chi tiêu thông minh là khi <span className="text-brand-ink">chi tiêu có kiểm soát</span>
            </p>
          </div>
        </section>

        <div className="auth-rise w-full max-w-md justify-self-center lg:justify-self-end" style={{ animationDelay: '120ms' }}>
          <div className="auth-card relative rounded-[28px] border border-line bg-surface/90 p-6 backdrop-blur-xl sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </main>
  )
}

/** Warm glow, a faint dot grid and slowly falling coins. Decorative only. */
export function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="auth-glow absolute inset-0" />
      <div className="auth-dots absolute inset-0" />
      <div className="auth-aurora auth-aurora-gold" />
      <div className="auth-aurora auth-aurora-green" />
      {FALLING_COINS.map((coin) => (
        <span
          key={coin.left}
          className="coin-fall"
          style={
            {
              left: coin.left,
              width: coin.size,
              '--dur': `${coin.dur}s`,
              '--delay': `${coin.delay}s`,
              '--drift': `${coin.drift}px`,
            } as CSSProperties
          }
        >
          {/* Depth lives on the coin: the falling wrapper's keyframes own its opacity. */}
          <GoldCoin
            className={coin.far ? 'coin-flip-loop w-full opacity-45 blur-[1.5px]' : 'coin-flip-loop w-full opacity-90'}
            style={{ animationDelay: `${coin.delay / 3}s` }}
          />
        </span>
      ))}
    </div>
  )
}

/** The hero: a big coin that bobs and flips, with a pulsing halo, two orbiting coins and sparkles. */
function CoinStage() {
  return (
    <div className="relative size-28 lg:size-36" aria-hidden>
      <span className="coin-halo absolute -inset-[35%] rounded-full" />
      <span className="coin-orbit absolute -inset-[22%]">
        <GoldCoin className="coin-orbit-item absolute top-0 left-1/2 w-[22%] -translate-x-1/2" />
        <GoldCoin className="coin-orbit-item absolute bottom-[8%] left-[4%] w-[15%]" />
      </span>
      <span className="coin-shadow absolute -bottom-[14%] left-[15%] h-[10%] w-[70%] rounded-[50%]" />
      <div className="coin-bob absolute inset-0">
        <div className="coin-flip relative size-full">
          <GoldCoin className="size-full drop-shadow-[0_10px_18px_rgba(168,108,6,0.45)]" />
          <span className="coin-shine absolute inset-[3%] overflow-hidden rounded-full" />
        </div>
      </div>
      <Sparkle className="sparkle absolute -top-[6%] -right-[4%] w-[18%] text-[var(--brand-hover)]" />
      <Sparkle className="sparkle absolute top-[38%] -left-[16%] w-[12%] text-[var(--brand-hover)]" style={{ animationDelay: '0.9s' }} />
      <Sparkle className="sparkle absolute -right-[18%] bottom-[10%] w-[10%] text-[var(--brand-hover)]" style={{ animationDelay: '1.7s' }} />
    </div>
  )
}
