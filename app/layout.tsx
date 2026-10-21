import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { OfflineBanner } from '@/components/app/offline-banner'
import { ThemeSync } from '@/components/app/theme-sync'
import { AppToaster } from '@/components/ui/toaster'
import { THEME_COLORS, THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'CT9 Finance', template: '%s · CT9 Finance' },
  description: 'Quản lý tài chính cá nhân: ghi chép thu chi, lập ngân sách và phân tích.',
  applicationName: 'CT9 Finance',
  // A personal app — keep it out of search engines.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'CT9 Finance', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Light-first; the inline theme script overrides this with the chosen theme.
  themeColor: THEME_COLORS.light,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is set by the inline script before first paint, not by React.
    <html lang="vi" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink">
        {children}
        <ThemeSync />
        <OfflineBanner />
        <AppToaster />
      </body>
    </html>
  )
}
