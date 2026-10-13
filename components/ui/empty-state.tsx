import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
