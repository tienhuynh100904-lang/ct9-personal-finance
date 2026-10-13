import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AddTransactionButton } from '@/components/app/navigation'
import { PageHeader } from '@/components/app/page-header'
import { TransactionsView } from '@/components/transactions/transactions-view'
import { Skeleton } from '@/components/ui/skeleton'
import { getTransactionsForYear, getYearOptions } from '@/lib/data'
import { resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Thu chi' }

export default function TransactionsPage({ searchParams }: PageProps<'/transactions'>) {
  return (
    <>
      <PageHeader
        title="Thu chi"
        description="Sổ ghi chép mọi khoản thu nhập và chi tiêu"
        actions={<AddTransactionButton className="hidden lg:inline-flex" />}
      />
      <Suspense fallback={<TransactionsSkeleton />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Transactions({ searchParams }: Pick<PageProps<'/transactions'>, 'searchParams'>) {
  const { year, today } = await resolveYear(searchParams)
  const [transactions, years] = await Promise.all([getTransactionsForYear(year), getYearOptions(today.year)])
  return (
    <TransactionsView
      year={year}
      years={years}
      defaultMonth={year === today.year ? today.month : 'all'}
      transactions={transactions}
    />
  )
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải giao dịch">
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="h-16" />
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  )
}
