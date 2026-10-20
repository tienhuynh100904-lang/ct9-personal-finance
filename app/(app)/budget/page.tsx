import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { BudgetView } from '@/components/budget/budget-view'
import { PageSkeleton } from '@/components/ui/skeleton'
import { getBudgetRows, getTransactionsForYear } from '@/lib/data'
import { YEAR_OPTIONS } from '@/lib/dates'
import { defaultMonthFor, resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Ngân sách' }

export default function BudgetPage({ searchParams }: PageProps<'/budget'>) {
  return (
    <>
      <PageHeader
        title="Ngân sách"
        description="Lập kế hoạch thu nhập, chi tiêu, tiết kiệm và theo dõi chênh lệch với thực tế"
      />
      <Suspense fallback={<PageSkeleton />}>
        <Budget searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Budget({ searchParams }: Pick<PageProps<'/budget'>, 'searchParams'>) {
  const { year, today } = await resolveYear(searchParams)
  const [transactions, budgetRows] = await Promise.all([getTransactionsForYear(year), getBudgetRows(year)])
  return (
    <BudgetView
      year={year}
      years={YEAR_OPTIONS}
      defaultMonth={defaultMonthFor(year, today, transactions)}
      transactions={transactions}
      budgetRows={budgetRows}
      today={today.iso}
    />
  )
}
