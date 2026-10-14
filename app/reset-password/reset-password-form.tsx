'use client'

import { Check, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AuthAlert, CoinSpinner } from '@/components/app/auth-ui'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrengthMeter } from '@/components/ui/password-strength'
import { resetPassword } from '@/lib/actions/auth'
import { checkPassword } from '@/lib/password-policy'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'

export function ResetPasswordForm({ email }: { email: string | null }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  /** Set once the confirmation field loses focus, so "doesn't match" isn't shown while it is still being typed. */
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [errors, setErrors] = useState<{ newPassword?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const check = checkPassword(newPassword, email)
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword
  /** Saving is only offered once the password is strong and confirmed. */
  const ready = check.strong && passwordsMatch
  const confirmError = confirmTouched && confirmPassword !== '' && !passwordsMatch ? 'Mật khẩu nhập lại không khớp.' : undefined

  function submit() {
    if (!ready) return
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await runAction(() => resetPassword({ newPassword }))
      if (!result) return
      if (result.ok) {
        toast.success('Đã đặt lại mật khẩu', { description: 'Các thiết bị khác đã được đăng xuất.' })
        router.replace('/')
        return
      }
      if ('expired' in result) {
        router.replace('/forgot-password?error=expired')
        return
      }
      setErrors(result.fieldErrors ?? {})
      setFormError(result.error)
    })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Mật khẩu mới" htmlFor="new-password" error={errors.newPassword}>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby="new-password-strength"
          required
          autoFocus
        />
      </Field>
      <PasswordStrengthMeter id="new-password-strength" check={check} />
      <Field
        label="Nhập lại mật khẩu mới"
        htmlFor="confirm-password"
        error={confirmError}
        hint={
          passwordsMatch ? (
            <span className="inline-flex items-center gap-1 font-medium text-positive">
              <Check key="match" className="icon-pop size-3.5" strokeWidth={3} aria-hidden />
              Hai mật khẩu đã khớp
            </span>
          ) : undefined
        }
      >
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          aria-invalid={Boolean(confirmError)}
          required
        />
      </Field>

      {formError && !errors.newPassword ? <AuthAlert key={formError}>{formError}</AuthAlert> : null}

      {ready ? (
        <Button type="submit" size="lg" className="btn-sheen rise-in w-full" disabled={pending}>
          {pending ? <CoinSpinner /> : <ShieldCheck className="icon-pop size-4" aria-hidden />}
          {pending ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </Button>
      ) : (
        <p className="text-center text-xs text-muted">Nút lưu sẽ hiện khi mật khẩu đạt đủ yêu cầu và hai ô trùng nhau.</p>
      )}
    </form>
  )
}
