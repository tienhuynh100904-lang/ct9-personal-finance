'use client'

import { ArrowLeft, Mail, MailCheck, Send } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { AuthAlert, CoinSpinner, FieldIcon } from '@/components/app/auth-ui'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { requestPasswordReset, type ResetRequestState } from '@/lib/actions/auth'

const initialState: ResetRequestState = { error: null, email: '', sentAt: null }
/** Seconds before "Gửi lại" works again (Supabase also limits how often one address can be mailed). */
const RESEND_AFTER = 60

const backLink =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-brand-ink hover:underline'

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [countedFor, setCountedFor] = useState<number | null>(null)

  // Restart the resend countdown each time a link is sent.
  if (state.sentAt !== countedFor) {
    setCountedFor(state.sentAt)
    setSecondsLeft(state.sentAt === null ? 0 : RESEND_AFTER)
  }
  useEffect(() => {
    if (state.sentAt === null) return
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [state.sentAt])

  if (state.sentAt !== null) {
    return (
      <div className="text-center">
        <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <span className="absolute inset-0 rounded-full border-2 border-[var(--brand-hover)] motion-safe:animate-[icon-ripple_1.6s_ease-out_infinite]" aria-hidden />
          <MailCheck className="icon-swing size-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">Kiểm tra email của bạn</h3>
        <p className="mt-2 text-sm text-ink-2">
          Nếu <span className="font-medium break-all text-ink">{state.email}</span> có tài khoản, chúng tôi đã gửi một liên kết để
          đặt lại mật khẩu. Liên kết có hiệu lực trong thời gian ngắn và chỉ dùng được một lần.
        </p>
        <p className="mt-2 text-xs text-muted">Không thấy email? Kiểm tra cả thư mục Spam.</p>

        <form action={formAction} className="mt-5">
          <input type="hidden" name="email" value={state.email} />
          <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={pending || secondsLeft > 0}>
            {pending ? <CoinSpinner /> : null}
            {secondsLeft > 0 ? `Gửi lại sau ${secondsLeft} giây` : 'Gửi lại liên kết'}
          </Button>
        </form>
        <Link href="/login" className={`${backLink} mt-2`}>
          <ArrowLeft className="size-4" aria-hidden />
          Quay lại đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink-2">Nhập email của tài khoản, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.</p>
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
            aria-invalid={Boolean(state.error)}
            className="pl-10"
          />
        </div>
      </Field>

      {state.error ? <AuthAlert key={state.error}>{state.error}</AuthAlert> : null}

      <Button type="submit" size="lg" className="btn-sheen w-full" disabled={pending}>
        {pending ? <CoinSpinner /> : <Send className="icon-hover-wiggle size-4" aria-hidden />}
        {pending ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
      </Button>
      <Link href="/login" className={`${backLink} w-full`}>
        <ArrowLeft className="size-4" aria-hidden />
        Quay lại đăng nhập
      </Link>
    </form>
  )
}
