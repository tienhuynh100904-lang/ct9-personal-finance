'use client'

import { LoaderCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { changePassword } from '@/lib/actions/auth'

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirm?: string }>({})
  const [pending, startTransition] = useTransition()

  function submit() {
    if (newPassword !== confirmPassword) {
      setErrors({ confirm: 'Mật khẩu nhập lại không khớp.' })
      return
    }
    setErrors({})
    startTransition(async () => {
      const result = await runAction(() => changePassword({ currentPassword, newPassword }))
      if (!result) return
      if (result.ok) {
        toast.success('Đã đổi mật khẩu', { description: 'Lần đăng nhập sau hãy dùng mật khẩu mới.' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Mật khẩu hiện tại" htmlFor="current-password" error={errors.currentPassword}>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          aria-invalid={Boolean(errors.currentPassword)}
          required
        />
      </Field>
      <Field label="Mật khẩu mới" htmlFor="new-password" error={errors.newPassword} hint="Ít nhất 8 ký tự">
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-invalid={Boolean(errors.newPassword)}
          minLength={8}
          required
        />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="confirm-password" error={errors.confirm}>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={Boolean(errors.confirm)}
          required
        />
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending || !currentPassword || !newPassword}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          Đổi mật khẩu
        </Button>
      </div>
    </form>
  )
}
