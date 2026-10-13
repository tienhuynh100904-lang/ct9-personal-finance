import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/actions/auth'
import { getSession } from '@/lib/auth'

export async function UserMenu() {
  const { user } = await getSession()
  const email = user.email ?? 'Tài khoản'
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <div
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase text-ink-2"
      >
        {email.charAt(0)}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-ink-2" title={email}>
        {email}
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </form>
    </div>
  )
}

export function UserMenuFallback() {
  return <div className="h-[52px]" aria-hidden />
}
