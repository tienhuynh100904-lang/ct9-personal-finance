'use client'

import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2">
        <TriangleAlert className="size-6 text-warning" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Không tải được dữ liệu</h2>
      <p className="mt-1 text-sm text-muted">
        Có thể do mất kết nối mạng hoặc Supabase đang tạm dừng. Vui lòng thử lại.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Mã lỗi: {error.digest}</p> : null}
      <Button className="mt-5" onClick={() => retry()}>
        <RotateCcw className="size-4 transition-transform duration-500 group-hover:-rotate-180" aria-hidden />
        Thử lại
      </Button>
    </div>
  )
}
