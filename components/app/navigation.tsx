'use client'

import { BookOpen, Plus, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import { BOTTOM_NAV_ITEMS, isActivePath, isTabActive, NAV_ITEMS } from './nav-items'

export function SidebarNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
              active
                ? 'bg-brand-soft font-semibold text-brand-ink'
                : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Icon
              className={cn('size-[18px] transition-transform duration-200 group-hover:scale-110', active ? 'icon-pop text-brand-ink' : 'text-muted')}
              aria-hidden
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AddTransactionButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => openComposer()} className={buttonClasses('primary', 'md', className)}>
      <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
      Thêm giao dịch
    </button>
  )
}

type NavItem = (typeof NAV_ITEMS)[number]

/**
 * Phone and tablet navigation: four destinations around a raised brand "Ghi" button, which stays
 * centered. The add button is the most-used control in the app, so it sits in the thumb zone.
 * Hướng dẫn and Cài đặt live in the top bar (see `TopBarLinks`); Thu chi is reached from Tổng quan.
 */
export function BottomNav() {
  const pathname = usePathname()
  const [first, second, third, fourth] = BOTTOM_NAV_ITEMS

  const renderLink = ({ href, label, icon: Icon }: NavItem) => {
    const active = isTabActive(pathname, href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex min-w-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors',
          active ? 'font-semibold text-brand-ink' : 'text-muted',
        )}
      >
        <span
          className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', active && 'bg-brand-soft')}
        >
          <Icon
            className={cn('size-[22px] transition-transform duration-200 group-active:scale-90', active && 'icon-pop')}
            aria-hidden
            strokeWidth={active ? 2.25 : 1.75}
          />
        </span>
        {label}
      </Link>
    )
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        {renderLink(first)}
        {renderLink(second)}
        <button
          type="button"
          onClick={() => openComposer()}
          className="group flex min-w-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-brand-ink"
          aria-label="Ghi giao dịch mới"
        >
          <span className="-mt-6 grid size-14 place-items-center rounded-2xl border border-brand-edge bg-brand text-on-brand shadow-[var(--shadow-fab)] ring-4 ring-surface transition-transform motion-safe:active:scale-95">
            <Plus className="size-7 transition-transform duration-300 group-hover:rotate-90 group-active:rotate-90" aria-hidden />
          </span>
          <span aria-hidden>Ghi</span>
        </button>
        {renderLink(third)}
        {renderLink(fourth)}
      </div>
    </nav>
  )
}

const TOP_BAR_LINKS = [
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpen, motion: 'group-hover:-rotate-6' },
  { href: '/settings', label: 'Cài đặt', icon: Settings, motion: 'group-hover:rotate-90' },
] as const

/** Phone and tablet top bar, right side: Hướng dẫn next to Cài đặt (the bottom bar keeps the daily pages). */
export function TopBarLinks() {
  const pathname = usePathname()
  return (
    <nav aria-label="Hướng dẫn và cài đặt" className="flex items-center gap-1">
      {TOP_BAR_LINKS.map(({ href, label, icon: Icon, motion }) => {
        const active = isActivePath(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group grid size-11 place-items-center rounded-xl transition-colors',
              active ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2 active:bg-surface-2',
            )}
          >
            <Icon className={cn('size-5 transition-transform duration-500', motion, active && 'icon-pop')} aria-hidden />
          </Link>
        )
      })}
    </nav>
  )
}
