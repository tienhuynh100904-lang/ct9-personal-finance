import { LogOut } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { ItemsManager } from '@/components/settings/items-manager'
import { ThemePicker } from '@/components/settings/theme-picker'
import { PasswordForm } from '@/components/settings/password-form'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { signOut } from '@/lib/actions/auth'
import { getSession } from '@/lib/auth'
import { getItems, getItemUsage } from '@/lib/data'

export const metadata: Metadata = { title: 'Cài đặt' }

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Cài đặt" description="Giao diện, khoản mục và tài khoản đăng nhập" />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Giao diện" description="Mặc định là giao diện sáng. Lựa chọn được lưu trên thiết bị này." />
          <CardBody>
            <ThemePicker />
          </CardBody>
        </Card>
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
              <h3 className="mb-3 text-sm font-semibold">Đổi mật khẩu</h3>
              <PasswordForm />
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

async function Items() {
  const [items, usage] = await Promise.all([getItems(), getItemUsage()])
  return <ItemsManager items={items} usage={usage} />
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
