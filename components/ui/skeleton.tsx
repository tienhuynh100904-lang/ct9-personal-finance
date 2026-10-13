import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-3/70', className)} />
}

/** Generic page placeholder: a stat row, two charts and a list. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải dữ liệu">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 lg:col-span-3" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

/** Home screen placeholder: hero, quick-log chips, then the stat grid. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải dữ liệu">
      <Skeleton className="h-72 rounded-3xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-28 shrink-0 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
