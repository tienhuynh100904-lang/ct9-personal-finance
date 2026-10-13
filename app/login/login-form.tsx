'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { signIn, type LoginState } from '@/lib/actions/auth'

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
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          defaultValue={state.email}
          required
          autoFocus
        />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" hint={<ForgotLink />}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
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

      {state.error ? (
        <p role="alert" className="rounded-xl bg-negative/10 px-3 py-2.5 text-sm font-medium text-negative">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
