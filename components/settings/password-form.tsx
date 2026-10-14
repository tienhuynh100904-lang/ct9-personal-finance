'use client'

import { Check, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrengthMeter } from '@/components/ui/password-strength'
import { checkPassword } from '@/lib/password-policy'
import { toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { changePassword } from '@/lib/actions/auth'

export function PasswordForm({ email }: { email: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  /** Set once the confirmation field loses focus, so "doesn't match" isn't shown while it is still being typed. */
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string }>({})
  const [pending, startTransition] = useTransition()

  const check = checkPassword(newPassword, email)
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword
  /** The submit button only appears once the new password is strong and confirmed. */
  const ready = check.strong && passwordsMatch
  const confirmError = confirmTouched && confirmPassword !== '' && !passwordsMatch ? 'Mật khẩu nhập lại không khớp.' : undefined

  function submit() {
    if (!ready) return
    setErrors({})
    startTransition(async () => {
      const result = await runAction(() => changePassword({ currentPassword, newPassword }))
      if (!result) return
      if (result.ok) {
        toast.success('Đã đổi mật khẩu', { description: 'Các thiết bị khác sẽ phải đăng nhập lại bằng mật khẩu mới.' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setConfirmTouched(false)
      } else {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Mật khẩu hiện tại" htmlFor="current-password" error={errors.currentPassword}>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          aria-invalid={Boolean(errors.currentPassword)}
          required
        />
      </Field>
      <Field label="Mật khẩu mới" htmlFor="new-password" error={errors.newPassword}>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby="new-password-strength"
          required
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
      {ready ? (
        <div className="rise-in">
          <Button type="submit" disabled={pending || !currentPassword}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="icon-pop size-4" aria-hidden />}
            Đổi mật khẩu
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Nút “Đổi mật khẩu” sẽ hiện khi mật khẩu mới đạt đủ yêu cầu và hai ô trùng nhau.</p>
      )}
    </form>
  )
}
