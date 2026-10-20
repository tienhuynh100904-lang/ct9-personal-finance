import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AnalysisView } from '@/components/analysis/analysis-view'
import { PageHeader } from '@/components/app/page-header'
import { PageSkeleton } from '@/components/ui/skeleton'
import { getTransactionsForYear } from '@/lib/data'
import { YEAR_OPTIONS } from '@/lib/dates'
import { resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Phân tích' }

export default function AnalysisPage({ searchParams }: PageProps<'/analytics'>) {
  return (
    <>
      <PageHeader title="Phân tích" description="Phân loại thu chi theo khoản mục, tỷ trọng và xu hướng cả năm" />
      <Suspense fallback={<PageSkeleton />}>
        <Analysis searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Analysis({ searchParams }: Pick<PageProps<'/analytics'>, 'searchParams'>) {
  const { year, today } = await resolveYear(searchParams)
  const transactions = await getTransactionsForYear(year)
  return (
    <AnalysisView
      year={year}
      years={YEAR_OPTIONS}
      highlightMonth={year === today.year ? today.month : undefined}
      transactions={transactions}
    />
  )
}
