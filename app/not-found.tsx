import { ArrowLeftRight, LayoutDashboard, Target, WalletMinimal } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthBackdrop } from '@/components/app/auth-card'
import { CoinDefs, GoldCoin, Sparkle } from '@/components/app/gold-coin'
import { buttonClasses } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Không tìm thấy trang' }

const SHORTCUTS = [
  { href: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/transactions', label: 'Thu chi', icon: ArrowLeftRight },
  { href: '/budget', label: 'Ngân sách', icon: WalletMinimal },
  { href: '/goals', label: 'Mục tiêu', icon: Target },
] as const

/**
 * The 404 page: the same gold-coin world as the sign-in pages. The "0" of 404 is a coin that bobs
 * and flips, so the page that went missing reads as a coin that rolled away. It renders inside the
 * root layout, so the light / dark theme applies. Motion is CSS only and stops under
 * prefers-reduced-motion (see "Auth shell" in globals.css).
 */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <CoinDefs />
      <AuthBackdrop />

      <div className="auth-rise relative w-full max-w-md text-center">

        <div
          role="img"
          aria-label="404"
          className="mt-4 flex items-center justify-center gap-1 text-[88px] leading-none font-bold tracking-tighter select-none sm:gap-2 sm:text-[128px]"
        >
          <span className="auth-title" aria-hidden>
            4
          </span>
          <span className="relative inline-block size-[0.78em]" aria-hidden>
            <span className="coin-halo absolute -inset-[32%] rounded-full" />
            <span className="coin-shadow absolute -bottom-[16%] left-[15%] h-[10%] w-[70%] rounded-[50%]" />
            <span className="coin-bob absolute inset-0">
              <span className="coin-flip relative block size-full">
                <GoldCoin symbol={false} className="size-full drop-shadow-[0_10px_18px_rgba(168,108,6,0.45)]" />
                <span className="coin-shine absolute inset-[3%] overflow-hidden rounded-full" />
              </span>
            </span>
            <Sparkle className="sparkle absolute -top-[8%] -right-[10%] w-[22%] text-[var(--brand-hover)]" />
            <Sparkle className="sparkle absolute bottom-[6%] -left-[14%] w-[16%] text-[var(--brand-hover)]" style={{ animationDelay: '1.1s' }} />
          </span>
          <span className="auth-title" aria-hidden style={{ animationDelay: '1.4s' }}>
            4
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Không tìm thấy trang</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2 sm:text-base">
          Đồng xu vừa lăn đi đâu mất. Đường dẫn không tồn tại hoặc đã bị đổi, nhưng tiền của bạn vẫn an toàn.
        </p>

        <Link href="/" className={buttonClasses('primary', 'lg', 'btn-sheen mt-6 w-full sm:w-auto sm:px-8')}>
          <LayoutDashboard className="icon-hover-wiggle size-4" aria-hidden />
          Về trang tổng quan
        </Link>

        <div className="mt-8">
          <p className="text-xs font-medium text-muted">Hoặc đi tới</p>
          <ul className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SHORTCUTS.map(({ href, label, icon: Icon }, i) => (
              <li key={href} className="auth-rise" style={{ animationDelay: `${250 + i * 80}ms` }}>
                <Link
                  href={href}
                  className="group flex h-full flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface/80 px-2 py-3 text-sm font-medium text-ink-2 backdrop-blur-md transition-colors hover:border-brand-edge hover:bg-brand-soft hover:text-brand-ink"
                >
                  <Icon className="size-5 text-muted transition-transform duration-200 group-hover:scale-110 group-hover:text-brand-ink" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
