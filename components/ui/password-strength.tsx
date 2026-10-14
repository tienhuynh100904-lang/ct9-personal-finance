'use client'

import { Check, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PasswordCheck, PasswordStrength } from '@/lib/password-policy'

const LEVELS: Record<PasswordStrength, { label: string; bars: number; bar: string; text: string }> = {
  empty: { label: 'Chưa nhập', bars: 0, bar: 'bg-surface-3', text: 'text-muted' },
  weak: { label: 'Yếu', bars: 1, bar: 'bg-[var(--s-critical)]', text: 'text-negative' },
  fair: { label: 'Trung bình', bars: 2, bar: 'bg-[var(--s-warning)]', text: 'text-warning' },
  good: { label: 'Khá', bars: 3, bar: 'bg-[var(--c-incidental)]', text: 'text-warning' },
  strong: { label: 'Mạnh', bars: 4, bar: 'bg-[var(--s-good)]', text: 'text-positive' },
}

/**
 * Four-segment strength meter plus the rule checklist. Each rule pops a check mark the moment it
 * passes, and the whole panel glows once every rule does, so building a strong password feels like
 * filling a progress bar rather than guessing.
 */
export function PasswordStrengthMeter({ check, id }: { check: PasswordCheck; id?: string }) {
  const level = LEVELS[check.strength]
  return (
    <div
      id={id}
      className={cn(
        'rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-500',
        check.strong
          ? 'border-[color-mix(in_oklab,var(--s-good)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-good)_7%,var(--surface))] shadow-[0_0_0_4px_color-mix(in_oklab,var(--s-good)_10%,transparent)]'
          : 'border-line bg-surface-2/60',
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-medium">
        <span className="text-ink-2">Độ mạnh mật khẩu</span>
        <span className={cn('inline-flex items-center gap-1 transition-colors', level.text)} aria-live="polite">
          {check.strong ? <ShieldCheck key="strong" className="icon-pop size-3.5" aria-hidden /> : null}
          {level.label}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <span
              className={cn(
                'block h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out)]',
                level.bar,
                i < level.bars ? 'scale-x-100' : 'scale-x-0',
              )}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          </span>
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-[13px] sm:grid-cols-2" aria-label="Yêu cầu mật khẩu">
        {check.rules.map((rule) => (
          <li key={rule.id} className={cn('flex items-start gap-2 transition-colors', rule.ok ? 'text-ink' : 'text-muted')}>
            <span
              className={cn(
                'mt-px grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-300',
                rule.ok ? 'border-transparent bg-[var(--s-good)] text-white' : 'border-line-strong bg-surface',
              )}
              aria-hidden
            >
              {rule.ok ? <Check key="ok" className="icon-pop size-3" strokeWidth={3} /> : null}
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{rule.ok ? ' — đã đạt' : ' — chưa đạt'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
