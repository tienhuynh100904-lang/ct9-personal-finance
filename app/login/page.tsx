import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { LogoMark } from '@/components/app/logo'
import { getSupabaseConfig } from '@/lib/supabase/env'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Đăng nhập' }

export default function LoginPage() {
  const configured = getSupabaseConfig() !== null

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">CT9 Finance</h1>
          <p className="mt-1 text-sm text-muted">Đăng nhập để quản lý tài chính cá nhân</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {configured ? null : (
            <div role="alert" className="mb-5 flex gap-2.5 rounded-xl bg-surface-2 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>
                Chưa cấu hình Supabase. Thêm <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> và{' '}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> vào <code className="text-xs">.env.local</code>{' '}
                (hoặc Environment Variables trên Vercel) rồi khởi động lại.
              </p>
            </div>
          )}
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Tài khoản được tạo trong Supabase Dashboard — ứng dụng không có chức năng đăng ký.
        </p>
      </div>
    </main>
  )
}
