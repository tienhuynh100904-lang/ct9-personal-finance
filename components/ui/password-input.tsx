'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { Input } from './field'

/** Password field with its own show/hide button; each instance reveals only itself. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-muted hover:text-ink"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff key="hide" className="icon-pop size-4" aria-hidden /> : <Eye key="show" className="icon-pop size-4" aria-hidden />}
      </button>
    </div>
  )
}
