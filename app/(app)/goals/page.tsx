import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/page-header'
import { GoalsView } from '@/components/goals/goals-view'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageSkeleton } from '@/components/ui/skeleton'
import { getGoalsData, getItems, getItemUsage } from '@/lib/data'
import { resolveYear } from '@/lib/period'

export const metadata: Metadata = { title: 'Mục tiêu' }

export default function GoalsPage({ searchParams }: PageProps<'/goals'>) {
  return (
    <>
      <PageHeader title="Mục tiêu" description="Xây quỹ khẩn cấp và các quỹ cho từng mục tiêu từ tiền bạn đã tiết kiệm" />
      <Suspense fallback={<PageSkeleton />}>
        <Goals searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Goals({ searchParams }: Pick<PageProps<'/goals'>, 'searchParams'>) {
  const { today } = await resolveYear(searchParams)
  const [data, items, usage] = await Promise.all([getGoalsData(today.iso), getItems(), getItemUsage()])
  if (!data) {
    return (
      <Card>
        <CardHeader title="Chưa bật tính năng Mục tiêu" />
        <CardBody>
          <p className="text-sm text-muted">Hãy chạy lại toàn bộ supabase/schema.sql trong Supabase (SQL Editor) để tạo các bảng cho quỹ. Dữ liệu cũ không bị ảnh hưởng.</p>
        </CardBody>
      </Card>
    )
  }
  return <GoalsView data={data} items={items} usage={usage} />
}
