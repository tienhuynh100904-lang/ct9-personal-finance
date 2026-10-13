import Link from 'next/link'

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <rect x="7" y="16" width="4.5" height="9" rx="1.5" fill="var(--c-income)" />
      <rect x="13.75" y="11" width="4.5" height="14" rx="1.5" fill="var(--c-expense)" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1.5" fill="var(--c-saving)" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="CT9 Finance — Tổng quan">
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">CT9 Finance</span>
        <span className="block text-[11px] text-muted">Tài chính cá nhân</span>
      </span>
    </Link>
  )
}
