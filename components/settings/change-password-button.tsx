'use client'

import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { PasswordForm } from './password-form'

/** "Đổi mật khẩu": one button in Cài đặt; the form itself opens in a dialog. */
export function ChangePasswordButton({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" aria-hidden />
        Đổi mật khẩu
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Đổi mật khẩu"
        description="Nhập mật khẩu hiện tại rồi chọn mật khẩu mới đủ mạnh. Các thiết bị khác sẽ bị đăng xuất."
      >
        {open ? <PasswordForm email={email} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  )
}
