import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CT9 Finance — Tài chính cá nhân',
    short_name: 'CT9 Finance',
    description: 'Ghi chép thu chi, lập ngân sách và phân tích tài chính cá nhân.',
    lang: 'vi',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f6f3',
    theme_color: '#f6f6f3',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
