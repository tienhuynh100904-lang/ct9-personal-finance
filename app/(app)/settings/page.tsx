import { KeyRound, LogOut } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { connection } from 'next/server'
import { ItemsManager } from '@/components/settings/items-manager'
import { RecurringManager } from '@/components/settings/recurring-manager'
import { ReminderSettings } from '@/components/settings/reminder-settings'
import { ThemePicker } from '@/components/settings/theme-picker'
import { PasswordForm } from '@/components/settings/password-form'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { signOut } from '@/lib/actions/auth'
import { getSession } from '@/lib/auth'
import { getItems, getItemUsage, getRecurringData, getReminderSettings } from '@/lib/data'
import { todayISO } from '@/lib/dates'

export const metadata: Metadata = { title: 'Cài đặt' }

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Cài đặt" description="Giao diện, nhắc ghi chép, khoản mục và tài khoản đăng nhập" />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Giao diện" description="Mặc định là giao diện sáng. Lựa chọn được lưu trên thiết bị này." />
          <CardBody>
            <ThemePicker />
          </CardBody>
        </Card>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Reminders />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Recurring />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Items />
        </Suspense>
        <Card>
          <CardHeader title="Tài khoản" description="Ứng dụng chỉ cho phép đăng nhập, không có đăng ký." />
          <CardBody className="space-y-6">
            <Suspense fallback={<Skeleton className="h-10 max-w-sm" />}>
              <Account />
            </Suspense>
            <div className="border-t border-line pt-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                  <KeyRound className="icon-swing size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Đổi mật khẩu</h3>
                  <p className="text-xs text-muted">Mật khẩu mới phải đạt đủ các yêu cầu bên dưới.</p>
                </div>
              </div>
              <Suspense fallback={<Skeleton className="h-96 max-w-md" />}>
                <ChangePassword />
              </Suspense>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

async function Reminders() {
  const settings = await getReminderSettings()
  return (
    <Card>
      <CardHeader title="Nhắc ghi chép" description="Thông báo trên điện thoại để bạn không quên ghi thu chi mỗi ngày." />
      <CardBody>
        {settings ? (
          <ReminderSettings initial={settings} />
        ) : (
          <p className="text-sm text-muted">Chưa bật tính năng nhắc. Hãy chạy lại supabase/schema.sql trong Supabase.</p>
        )}
      </CardBody>
    </Card>
  )
}

async function Recurring() {
  await connection()
  const data = await getRecurringData(todayISO())
  if (!data) {
    return (
      <Card id="recurring">
        <CardHeader title="Giao dịch định kỳ" description="Tiền nhà, điện nước, wifi, lương… tự gợi ý mỗi tháng." />
        <CardBody>
          <p className="text-sm text-muted">Chưa bật tính năng này. Hãy chạy lại supabase/schema.sql trong Supabase.</p>
        </CardBody>
      </Card>
    )
  }
  return <RecurringManager rules={data.rules} />
}

async function Items() {
  const [items, usage] = await Promise.all([getItems(), getItemUsage()])
  return <ItemsManager items={items} usage={usage} />
}

/** The form needs the email so the policy can reject passwords built from it. */
async function ChangePassword() {
  const { user } = await getSession()
  return <PasswordForm email={user.email} />
}

async function Account() {
  const { user } = await getSession()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted">Đang đăng nhập bằng</p>
        <p className="font-medium">{user.email}</p>
      </div>
      <form action={signOut}>
        <button type="submit" className={buttonClasses('secondary')}>
          <LogOut className="size-4" aria-hidden />
          Đăng xuất
        </button>
      </form>
    </div>
  )
}
