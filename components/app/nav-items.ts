import { ArrowLeftRight, ChartColumnBig, LayoutDashboard, Settings, WalletMinimal } from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/thu-chi', label: 'Thu chi', icon: ArrowLeftRight },
  { href: '/phan-tich', label: 'Phân tích', icon: ChartColumnBig },
  { href: '/ngan-sach', label: 'Ngân sách', icon: WalletMinimal },
  { href: '/cai-dat', label: 'Cài đặt', icon: Settings },
] as const

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
