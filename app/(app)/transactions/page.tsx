import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AddTransactionButton } from '@/components/app/navigation'
import { PageHeader } from '@/components/app/page-header'
import { TransactionsView } from '@/components/transactions/transactions-view'
import { Skeleton } from '@/components/ui/skeleton'
import { getBudgetRows, getTransactionsForYear } from '@/lib/data'
import { YEAR_OPTIONS } from '@/lib/dates'
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
  const [transactions, budgetRows] = await Promise.all([getTransactionsForYear(year), getBudgetRows(year)])
  return (
    <TransactionsView
      year={year}
      years={YEAR_OPTIONS}
      defaultMonth={year === today.year ? today.month : 'all'}
      current={{ year: today.year, month: today.month }}
      transactions={transactions}
      budgetRows={budgetRows}
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
