'use client'

import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CoinSpinner, FieldIcon } from '@/components/app/auth-ui'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { signIn, type LoginState } from '@/lib/actions/auth'
import { toast } from '@/lib/toast'

const initialState: LoginState = { error: null, email: '' }

function ForgotLink() {
  return (
    <span className="flex justify-end">
      <Link href="/forgot-password" className="-my-1 inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-ink hover:underline">
        Quên mật khẩu?
      </Link>
    </span>
  )
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Each failed attempt returns a new state object, so the same message is shown again on a repeat failure.
  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  // Signed out on this device: the offline page should no longer list the previous account's items.
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: 'ct9-forget' })
  }, [])

  // Next.js keeps this page mounted (hidden) after signing in; don't leave the password in the DOM.
  useLayoutEffect(() => {
    const form = formRef.current
    return () => {
      form?.reset()
      setShowPassword(false)
    }
  }, [])

  return (
    <form
      ref={formRef}
      action={(formData) => {
        // Return to the page that sent the visitor here (validated again on the server).
        formData.set('next', new URLSearchParams(window.location.search).get('next') ?? '/')
        formAction(formData)
      }}
      className="space-y-4"
    >
      <Field label="Email" htmlFor="email">
        <div className="relative">
          <FieldIcon>
            <Mail />
          </FieldIcon>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            defaultValue={state.email}
            placeholder="ban@email.com"
            required
            autoFocus
            className="pl-10"
          />
        </div>
      </Field>
      <Field label="Mật khẩu" htmlFor="password" hint={<ForgotLink />}>
        <div className="relative">
          <FieldIcon>
            <LockKeyhole />
          </FieldIcon>
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="pr-11 pl-10"
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

      <Button type="submit" size="lg" className="btn-sheen w-full" disabled={pending}>
        {pending ? <CoinSpinner /> : <LogIn className="icon-hover-wiggle size-4" aria-hidden />}
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
