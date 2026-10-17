import { ArrowLeftRight, BookOpen, ChartColumnBig, LayoutDashboard, Settings, Target, WalletMinimal } from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/transactions', label: 'Thu chi', icon: ArrowLeftRight },
  { href: '/analytics', label: 'Phân tích', icon: ChartColumnBig },
  { href: '/budget', label: 'Ngân sách', icon: WalletMinimal },
  { href: '/goals', label: 'Mục tiêu', icon: Target },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpen },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
] as const

/**
 * The phone/tablet bottom bar: four destinations around the "Ghi" button, so it stays centered.
 * Thu chi is not here: on a phone it is one tap from Tổng quan ("Xem tất cả" under "Giao dịch gần
 * đây"). The desktop sidebar has room, so it keeps every item in NAV_ITEMS.
 */
export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.href !== '/transactions')

/** Pages reached from a tab that has no tab of its own: the tab stays lit while you are there. */
const TAB_CHILDREN: Record<string, string[]> = { '/': ['/transactions'] }

export function isTabActive(pathname: string, href: string) {
  return isActivePath(pathname, href) || (TAB_CHILDREN[href] ?? []).some((child) => isActivePath(pathname, child))
}

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
