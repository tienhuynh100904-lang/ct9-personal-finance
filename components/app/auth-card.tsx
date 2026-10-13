import type { ReactNode } from 'react'
import { LogoMark } from './logo'

/** The centered logo + card shared by the signed-out pages (login, forgot and reset password). */
export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">CT9 Finance</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-1)]">{children}</div>
      </div>
    </main>
  )
}
