import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthCard } from '@/components/app/auth-card'
import { hasPasswordReset } from '@/lib/password-reset'
import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = { title: 'Đặt mật khẩu mới' }

export default function ResetPasswordPage() {
  return (
    <AuthCard subtitle="Đặt mật khẩu mới">
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <ResetGate />
      </Suspense>
    </AuthCard>
  )
}

/** The form is only for someone who just opened a reset link; anyone else is sent to ask for one. */
async function ResetGate() {
  if (!(await hasPasswordReset())) redirect('/forgot-password?error=expired')
  return <ResetPasswordForm />
}
