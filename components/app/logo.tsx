import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/cn'

/** Small on screen, so the version without the letters (they would be unreadable). Two files, one per theme: the dark variant is shown under data-theme="dark" (see @custom-variant in globals.css). */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  const shared = 'rounded-[28%]'
  return (
    <>
      <Image
        src="/imgs/Logo_Light_No_Word.png"
        alt=""
        width={96}
        height={96}
        className={cn(className, shared, 'dark:hidden')}
      />
      <Image
        src="/imgs/Logo_Dark_No_Word.png"
        alt=""
        width={96}
        height={96}
        className={cn(className, shared, 'hidden dark:block')}
      />
    </>
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
