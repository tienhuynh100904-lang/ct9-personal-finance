'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { subscribeComposer, type ComposerPreset, type EditableTransaction, openComposer } from '@/lib/composer'
import { todayISO } from '@/lib/dates'
import type { Kind } from '@/lib/finance'
import { formatDayLabel } from '@/lib/format'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { TransactionForm } from './transaction-form'

type Session = {
  key: number
  kind: Kind
  date: string | null
  preset: ComposerPreset | null
  transaction: EditableTransaction | null
}

/** The single add/edit transaction dialog, opened via `openComposer()` from anywhere. */
export function TransactionComposer({ items, usage }: { items: ItemRecord[]; usage: ItemUsage[] }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session>({ key: 0, kind: 'expense', date: null, preset: null, transaction: null })

  useEffect(
    () =>
      subscribeComposer((request) => {
        setSession((current) => ({
          key: current.key + 1,
          kind: request.transaction?.kind ?? request.kind ?? 'expense',
          date: request.date ?? null,
          preset: request.preset ?? null,
          transaction: request.transaction ?? null,
        }))
        setOpen(true)
      }),
    [],
  )

  // Deep link from the app-icon shortcuts (/?add=expense, /?add=income): open the sheet, then tidy the URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const raw = url.searchParams.get('add')
    const target = raw === 'expense' ? 'expense' : raw === 'income' ? 'income' : null
    if (!target) return
    url.searchParams.delete('add')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    openComposer({ kind: target })
  }, [])

  const backfill = !session.transaction && session.date && session.date !== todayISO()
  const title = session.transaction ? 'Sửa giao dịch' : backfill ? `Ghi bù ${formatDayLabel(session.date!)}` : 'Thêm giao dịch'

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={title}>
      {open ? (
        <TransactionForm
          key={session.key}
          initial={session.transaction}
          initialKind={session.kind}
          initialDate={session.date}
          preset={session.preset}
          items={items}
          usage={usage}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}
