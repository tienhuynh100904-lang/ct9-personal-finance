import type { MetadataRoute } from 'next'
import { THEME_COLORS } from '@/lib/theme'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CT9 Finance — Tài chính cá nhân',
    short_name: 'CT9 Finance',
    description: 'Ghi chép thu chi, lập ngân sách và phân tích tài chính cá nhân.',
    lang: 'vi',
    start_url: '/',
    display: 'standalone',
    // Splash screen only. A manifest has one colour for both themes, so it never sets
    // `theme_color`: on Android that would paint the installed app's bottom navigation bar light
    // even in dark mode. The status bar follows the page's theme-color meta (lib/theme.ts) instead.
    background_color: THEME_COLORS.light,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    // Long-press the app icon (Android/Chrome): jump straight into logging.
    shortcuts: [
      { name: 'Ghi khoản chi', short_name: 'Ghi chi', url: '/?add=expense' },
      { name: 'Ghi khoản thu', short_name: 'Ghi thu', url: '/?add=income' },
    ],
  }
}
