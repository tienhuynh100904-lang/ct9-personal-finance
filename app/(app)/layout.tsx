import { Settings } from 'lucide-react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { Suspense } from 'react'
import { Logo } from '@/components/app/logo'
import { AddTransactionButton, BottomNav, SidebarNav } from '@/components/app/navigation'
import { UserMenu, UserMenuFallback } from '@/components/app/user-menu'
import { TransactionComposer } from '@/components/transactions/composer'
import { getItems, getItemUsage } from '@/lib/data'
import type { ItemRecord, ItemUsage } from '@/lib/types'

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-6 pb-5">
          <Logo />
        </div>
        <div className="px-3">
          <AddTransactionButton className="w-full" />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto px-3">
          <SidebarNav />
        </div>
        <div className="border-t border-line px-3 py-3">
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Link
          href="/cai-dat"
          className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
          aria-label="Cài đặt"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        {children}
      </main>

      <BottomNav />

      <Suspense fallback={null}>
        <ComposerLoader />
      </Suspense>
    </div>
  )
}

/** Loads item suggestions for the add/edit dialog without holding up the page. */
async function ComposerLoader() {
  const [items, usage] = await Promise.all([getItems(), getItemUsage()]).catch(
    (error: unknown): [ItemRecord[], ItemUsage[]] => {
      unstable_rethrow(error)
      console.error('Could not load item suggestions', error)
      return [[], []]
    },
  )
  return <TransactionComposer items={items} usage={usage} />
}
