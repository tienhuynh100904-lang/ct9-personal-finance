import { LogOut } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
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
      <Tooltip label={email} align="start" className="min-w-0 flex-1">
        <p className="min-w-0 flex-1 truncate text-sm text-ink-2">{email}</p>
      </Tooltip>
      <form action={signOut}>
        <Tooltip label="Đăng xuất" align="end">
          <button
            type="submit"
            className="group grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Đăng xuất"
          >
            <LogOut className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </button>
        </Tooltip>
      </form>
    </div>
  )
}

export function UserMenuFallback() {
  return <div className="h-[52px]" aria-hidden />
}
