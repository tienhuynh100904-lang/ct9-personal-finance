import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { getBudgetRows, getHabitData, getRecurringData, getTransactionsForYear } from '@/lib/data'
import { YEAR_OPTIONS } from '@/lib/dates'
import { defaultMonthFor, resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Tổng quan' }

export default function DashboardPage({ searchParams }: PageProps<'/'>) {
  return (
    <>
      <PageHeader title="Tổng quan" description="Bức tranh thu chi của bạn trong tháng" className="max-sm:sr-only" />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Dashboard({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { year, today } = await resolveYear(searchParams)
  const [transactions, budgetRows, habit, recurring] = await Promise.all([
    getTransactionsForYear(year),
    getBudgetRows(year),
    getHabitData(today.iso, today.hour),
    getRecurringData(today.iso),
  ])
  return (
    <DashboardView
      year={year}
      years={YEAR_OPTIONS}
      defaultMonth={defaultMonthFor(year, today, transactions)}
      transactions={transactions}
      budgetRows={budgetRows}
      habit={habit}
      recurring={recurring}
    />
  )
}
