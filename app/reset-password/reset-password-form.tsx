'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { resetPassword } from '@/lib/actions/auth'
import { runAction } from '@/lib/run-action'
import { toast } from '@/lib/toast'

export function ResetPasswordForm() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ newPassword?: string; confirm?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (newPassword !== confirmPassword) {
      setErrors({ confirm: 'Mật khẩu nhập lại không khớp.' })
      return
    }
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
      <Field label="Mật khẩu mới" htmlFor="new-password" error={errors.newPassword} hint="Ít nhất 8 ký tự">
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-invalid={Boolean(errors.newPassword)}
            minLength={8}
            required
            autoFocus
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-muted hover:text-ink"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff key="hide" className="icon-pop size-4" aria-hidden /> : <Eye key="show" className="icon-pop size-4" aria-hidden />}
          </button>
        </div>
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="confirm-password" error={errors.confirm}>
        <Input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={Boolean(errors.confirm)}
          required
        />
      </Field>

      {formError && !errors.newPassword ? (
        <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2.5 text-sm font-medium text-negative">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !newPassword || !confirmPassword}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
      </Button>
    </form>
  )
}
