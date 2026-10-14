import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthCard } from '@/components/app/auth-card'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = { title: 'Quên mật khẩu' }

export default function ForgotPasswordPage({ searchParams }: PageProps<'/forgot-password'>) {
  return (
    <AuthCard title="Quên mật khẩu?" subtitle="Đặt lại mật khẩu qua email">
      <Suspense fallback={null}>
        <ExpiredNotice searchParams={searchParams} />
      </Suspense>
      <ForgotPasswordForm />
    </AuthCard>
  )
}

/** Shown when /auth/confirm rejected the emailed link (expired, already used, or malformed). */
async function ExpiredNotice({ searchParams }: Pick<PageProps<'/forgot-password'>, 'searchParams'>) {
  const { error } = await searchParams
  if (error !== 'expired') return null
  return (
    <div role="alert" className="mb-5 flex gap-2.5 rounded-xl bg-negative/10 p-3 text-sm font-medium text-negative">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu một liên kết mới bên dưới.</p>
    </div>
  )
}
