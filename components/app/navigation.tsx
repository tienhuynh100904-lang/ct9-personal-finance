'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import { isActivePath, NAV_ITEMS } from './nav-items'

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
              'flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
              active ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Icon className={cn('size-[18px]', active ? 'text-ink' : 'text-muted')} aria-hidden />
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
      <Plus className="size-4" aria-hidden />
      Thêm giao dịch
    </button>
  )
}

/** Phone navigation: four destinations around a central "add" button. */
export function BottomNav() {
  const pathname = usePathname()
  const [first, second, third, fourth] = NAV_ITEMS
  const renderLink = ({ href, label, icon: Icon }: (typeof NAV_ITEMS)[number]) => {
    const active = isActivePath(pathname, href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
          active ? 'font-semibold text-ink' : 'text-muted',
        )}
      >
        <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
        {label}
      </Link>
    )
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {renderLink(first)}
        {renderLink(second)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openComposer()}
            className="grid size-12 place-items-center rounded-2xl bg-ink text-surface shadow-lg shadow-black/20 transition-transform active:scale-95"
            aria-label="Thêm giao dịch"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
        {renderLink(third)}
        {renderLink(fourth)}
      </div>
    </nav>
  )
}
