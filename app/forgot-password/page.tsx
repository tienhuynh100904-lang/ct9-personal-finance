import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthCard } from '@/components/app/auth-card'
import { ErrorToastOnMount } from '@/components/app/toast-on-mount'
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

/** Toasts when /auth/confirm rejected the emailed link (expired, already used, or malformed). */
async function ExpiredNotice({ searchParams }: Pick<PageProps<'/forgot-password'>, 'searchParams'>) {
  const { error } = await searchParams
  if (error !== 'expired') return null
  return <ErrorToastOnMount message="Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu một liên kết mới bên dưới." />
}
