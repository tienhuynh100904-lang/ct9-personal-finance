import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { AuthCard } from '@/components/app/auth-card'
import { getSupabaseConfig } from '@/lib/supabase/env'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Đăng nhập' }

export default function LoginPage() {
  const configured = getSupabaseConfig() !== null

  return (
    <AuthCard title="Chào mừng trở lại" subtitle="Đăng nhập để quản lý tài chính cá nhân">
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
    </AuthCard>
  )
}
