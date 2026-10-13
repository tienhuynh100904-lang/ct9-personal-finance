import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { PageSkeleton } from '@/components/ui/skeleton'
import { getBudgetRows, getTransactionsForYear, getYearOptions } from '@/lib/data'
import { defaultMonthFor, resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Tổng quan' }

export default function DashboardPage({ searchParams }: PageProps<'/'>) {
  return (
    <>
      <PageHeader title="Tổng quan" description="Bức tranh thu chi của bạn trong tháng" />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Dashboard({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { year, today } = await resolveYear(searchParams)
  const [transactions, budgetRows, years] = await Promise.all([
    getTransactionsForYear(year),
    getBudgetRows(year),
    getYearOptions(today.year),
  ])
  return (
    <DashboardView
      year={year}
      years={years}
      defaultMonth={defaultMonthFor(year, today, transactions)}
      transactions={transactions}
      budgetRows={budgetRows}
    />
  )
}
