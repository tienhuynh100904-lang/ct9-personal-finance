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
    // One colour for both themes (a manifest cannot vary it). Besides the splash screen, Android 15+
    // fills the installed app's window with it, and that shows through the transparent bottom
    // navigation bar. Dark, so the bar is not a pale strip in dark mode. `theme_color` is left out on
    // purpose: the status bar follows the page's theme-color meta (lib/theme.ts), and setting it here
    // would also paint the navigation bar on Android 14 and older.
    background_color: THEME_COLORS.dark,
    icons: [
      { src: '/imgs/Logo_Dark.png', sizes: '500x500', type: 'image/png', purpose: 'any' },
      { src: '/imgs/Logo_Dark.png', sizes: '500x500', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the app icon (Android/Chrome): jump straight into logging.
    shortcuts: [
      { name: 'Ghi khoản chi', short_name: 'Ghi chi', url: '/?add=expense' },
      { name: 'Ghi khoản thu', short_name: 'Ghi thu', url: '/?add=income' },
    ],
  }
}
