import { ArrowLeftRight, BookOpen, ChartColumnBig, LayoutDashboard, Settings, WalletMinimal } from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/transactions', label: 'Thu chi', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Phân tích', icon: ChartColumnBig },
  { href: '/budget', label: 'Ngân sách', icon: WalletMinimal },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpen },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
] as const

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
