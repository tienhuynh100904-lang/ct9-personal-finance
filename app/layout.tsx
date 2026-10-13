import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg font-sans text-ink">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
