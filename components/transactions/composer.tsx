'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { subscribeComposer, type EditableTransaction } from '@/lib/composer'
import type { Kind } from '@/lib/finance'
import type { ItemRecord, ItemUsage } from '@/lib/types'
import { TransactionForm } from './transaction-form'

/** The single add/edit transaction dialog, opened via `openComposer()` from anywhere. */
export function TransactionComposer({ items, usage }: { items: ItemRecord[]; usage: ItemUsage[] }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<{ key: number; kind: Kind; transaction: EditableTransaction | null }>({
    key: 0,
    kind: 'expense',
    transaction: null,
  })

  useEffect(
    () =>
      subscribeComposer((request) => {
        setSession((current) => ({
          key: current.key + 1,
          kind: request.transaction?.kind ?? request.kind ?? 'expense',
          transaction: request.transaction ?? null,
        }))
        setOpen(true)
      }),
    [],
  )

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={session.transaction ? 'Sửa giao dịch' : 'Thêm giao dịch'}
    >
      {open ? (
        <TransactionForm
          key={session.key}
          initial={session.transaction}
          initialKind={session.kind}
          items={items}
          usage={usage}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}
