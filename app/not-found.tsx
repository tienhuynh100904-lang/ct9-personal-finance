import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Không tìm thấy trang</h1>
      <p className="mt-1 text-sm text-muted">Đường dẫn không tồn tại hoặc đã bị thay đổi.</p>
      <Link href="/" className={buttonClasses('primary', 'md', 'mt-6')}>
        Về trang tổng quan
      </Link>
    </main>
  )
}
