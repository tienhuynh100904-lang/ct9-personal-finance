import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Home-screen icon for iPhone ("Thêm vào MH chính"), drawn at build time. */
export default function AppleIcon() {
  const bar = (height: number, color: string) => (
    <div style={{ width: 26, height, borderRadius: 8, background: color }} />
  )
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 12,
          paddingBottom: 40,
          background: '#0b0b0b',
        }}
      >
        {bar(52, '#1baf7a')}
        {bar(80, '#eb6834')}
        {bar(104, '#2a78d6')}
      </div>
    ),
    size,
  )
}
