import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthCard } from '@/components/app/auth-card'
import { getSession } from '@/lib/auth'
import { hasPasswordReset } from '@/lib/password-reset'
import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = { title: 'Đặt mật khẩu mới' }

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Tạo mật khẩu mới" subtitle="Đặt mật khẩu mới">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <ResetGate />
      </Suspense>
    </AuthCard>
  )
}

/** The form is only for someone who just opened a reset link; anyone else is sent to ask for one. */
async function ResetGate() {
  if (!(await hasPasswordReset())) redirect('/forgot-password?error=expired')
  // Opening the link signed the user in; the email lets the policy reject passwords built from it.
  const { user } = await getSession()
  return <ResetPasswordForm email={user.email} />
}
