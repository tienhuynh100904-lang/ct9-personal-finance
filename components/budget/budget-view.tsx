'use client'

import { LoaderCircle, RotateCcw } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { useMonthParam, YearSelect } from '@/components/app/period'
import { MonthlyTable, type TableRow } from '@/components/analysis/monthly-table'
import { MonthlyBars } from '@/components/charts/monthly-bars'
import { BudgetAlerts } from '@/components/dashboard/budget-alerts'
import { AmountInput } from '@/components/ui/amount-input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Segmented } from '@/components/ui/choice'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MonthPicker } from '@/components/ui/month-picker'
import { toast } from '@/lib/toast'
import { runAction } from '@/lib/run-action'
import { saveBudgetMonth } from '@/lib/actions/budgets'
import { CATEGORY_META, MEASURE_COLOR } from '@/lib/categories'
import { cn } from '@/lib/cn'
import {
  BUDGET_CATEGORIES,
  budgetAlerts,
  buildBudgetPlan,
  buildYearReport,
  compareBudget,
  INCOME_CATEGORIES,
  monthSnapshot,
  SPENDING_CATEGORIES,
  sum,
  type BudgetCategory,
  type BudgetComparison,
  type BudgetPlan,
  type BudgetRow,
  type YearReport,
} from '@/lib/finance'
import { formatSignedVND, formatVND } from '@/lib/format'
import type { TransactionRecord } from '@/lib/types'

type View = 'planned' | 'actual' | 'variance'

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'planned', label: 'Dự kiến' },
  { value: 'actual', label: 'Thực tế' },
  { value: 'variance', label: 'Chênh lệch' },
]

function actualFor(category: BudgetCategory, report: YearReport, month: number) {
  const i = month - 1
  if (category === 'saving') return report.saving[i]
  if ((INCOME_CATEGORIES as readonly string[]).includes(category)) {
    return report.income[category as (typeof INCOME_CATEGORIES)[number]][i]
  }
  return report.spending[category as (typeof SPENDING_CATEGORIES)[number]][i]
}

export function BudgetView({
  year,
  years,
  defaultMonth,
  transactions,
  budgetRows,
  today,
}: {
  year: number
  years: number[]
  defaultMonth: number
  transactions: TransactionRecord[]
  budgetRows: BudgetRow[]
  /** Today (`YYYY-MM-DD`, Vietnam time). */
  today: string
}) {
  const [monthParam, setMonth] = useMonthParam(defaultMonth)
  const month = monthParam === 'all' ? defaultMonth : monthParam
  const report = useMemo(() => buildYearReport(transactions, year), [transactions, year])
  const plan = useMemo(() => buildBudgetPlan(budgetRows), [budgetRows])
  const comparison = useMemo(() => compareBudget(plan, report), [plan, report])
  const alerts = budgetAlerts(monthSnapshot(report, plan, month).spendingByCategory)
  const editorKey = `${year}-${month}-${BUDGET_CATEGORIES.map((c) => plan[c][month - 1]).join(',')}`

  return (
    <div className="space-y-4">
      <YearSelect year={year} years={years} />
      <BudgetAlerts alerts={alerts} year={year} month={month} today={today} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <BudgetEditor key={editorKey} year={year} month={month} onMonthChange={setMonth} plan={plan} report={report} />
        <div className="space-y-4">
          <MonthlyBars
            title="Thu nhập: dự kiến vs thực tế"
            height={200}
            series={[
              { key: 'planned', label: 'Dự kiến', color: MEASURE_COLOR.planned, values: comparison.income.plannedTotal },
              { key: 'actual', label: 'Thực tế', color: MEASURE_COLOR.income, values: comparison.income.actualTotal },
            ]}
          />
          <MonthlyBars
            title="Chi tiêu: dự kiến vs thực tế"
            height={200}
            series={[
              { key: 'planned', label: 'Dự kiến', color: MEASURE_COLOR.planned, values: comparison.spending.plannedTotal },
              { key: 'actual', label: 'Thực tế', color: MEASURE_COLOR.spending, values: comparison.spending.actualTotal },
            ]}
          />
          <MonthlyBars
            title="Tiết kiệm/Đầu tư: dự kiến vs thực tế"
            height={200}
            series={[
              { key: 'planned', label: 'Dự kiến', color: MEASURE_COLOR.planned, values: comparison.saving.planned },
              { key: 'actual', label: 'Thực tế', color: MEASURE_COLOR.saving, values: comparison.saving.actual },
            ]}
          />
        </div>
      </div>

      <BudgetTables comparison={comparison} month={month} />
    </div>
  )
}

function BudgetEditor({
  year,
  month,
  onMonthChange,
  plan,
  report,
}: {
  year: number
  month: number
  onMonthChange: (month: number) => void
  plan: BudgetPlan
  report: YearReport
}) {
  const initial = useMemo(
    () => Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, plan[c][month - 1]])) as Record<BudgetCategory, number>,
    [plan, month],
  )
  const [values, setValues] = useState(initial)
  const [applyToFollowing, setApplyToFollowing] = useState(false)
  // The month the user asked for while there were unsaved changes; asks before discarding them.
  const [leavingTo, setLeavingTo] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = BUDGET_CATEGORIES.some((c) => values[c] !== initial[c])

  function save() {
    startTransition(async () => {
      const result = await runAction(() =>
        saveBudgetMonth({
          year,
          month,
          values,
          applyToFollowingMonths: applyToFollowing && month < 12,
        }),
      )
      if (!result) return
      if (result.ok) toast.success('Đã lưu ngân sách', { description: result.message })
      else toast.error(result.error)
    })
  }

  const groups: { title: string; categories: readonly BudgetCategory[]; goodWhenAbove: boolean }[] = [
    { title: 'Thu nhập dự kiến', categories: INCOME_CATEGORIES, goodWhenAbove: true },
    { title: 'Chi tiêu dự kiến', categories: SPENDING_CATEGORIES, goodWhenAbove: false },
    { title: 'Tiết kiệm/Đầu tư dự kiến', categories: ['saving'], goodWhenAbove: true },
  ]

  return (
    <Card className="lg:sticky lg:top-8">
      <CardHeader
        title={`Kế hoạch tháng · năm ${year}`}
        description="Nhập số tiền dự kiến; thực tế được tính từ sổ thu chi"
        action={
          <MonthPicker
            className="w-36"
            label="Chọn tháng"
            compact
            year={year}
            month={month}
            years={[year]}
            onChange={(_, next) => {
              if (dirty) setLeavingTo(Number(next))
              else onMonthChange(Number(next))
            }}
          />
        }
      />
      <ConfirmDialog
        open={leavingTo !== null}
        title="Bỏ thay đổi chưa lưu?"
        description={`Số tiền bạn vừa nhập cho tháng ${month} sẽ mất nếu chuyển sang tháng khác.`}
        confirmLabel="Bỏ và chuyển tháng"
        destructive
        onCancel={() => setLeavingTo(null)}
        onConfirm={() => {
          if (leavingTo !== null) onMonthChange(leavingTo)
          setLeavingTo(null)
        }}
      />
      <form
        className="space-y-5 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {groups.map((group) => {
          const plannedSum = sum(group.categories.map((c) => values[c]))
          return (
            <fieldset key={group.title} className="space-y-3">
              <legend className="flex w-full items-baseline justify-between text-sm font-semibold">
                <span>{group.title}</span>
                <span className="font-medium tabular-nums text-ink-2">{formatVND(plannedSum)}</span>
              </legend>
              {group.categories.map((category) => {
                const actual = actualFor(category, report, month)
                const variance = actual - values[category]
                const good = variance === 0 ? null : group.goodWhenAbove ? variance > 0 : variance < 0
                const id = `budget-${category}`
                return (
                  <div key={category}>
                    <label htmlFor={id} className="mb-1 flex items-center gap-2 text-sm text-ink-2">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: CATEGORY_META[category].color }} />
                      {CATEGORY_META[category].label}
                    </label>
                    <AmountInput
                      id={id}
                      value={values[category]}
                      onValueChange={(v) => setValues((current) => ({ ...current, [category]: v }))}
                      className="h-10"
                    />
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      <span>Thực tế {formatVND(actual)}</span>
                      {values[category] > 0 || actual > 0 ? (
                        <span
                          className={cn(
                            'tabular-nums',
                            good === true && 'text-positive',
                            good === false && 'text-negative',
                          )}
                        >
                          · chênh lệch {formatSignedVND(variance)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                )
              })}
            </fieldset>
          )
        })}

        <Checkbox
          card
          checked={applyToFollowing && month < 12}
          disabled={month === 12}
          onChange={(e) => setApplyToFollowing(e.target.checked)}
          hint={month < 12 ? `Ghi cùng số tiền cho tháng ${month + 1}–12/${year}` : 'Tháng 12 là tháng cuối năm'}
        >
          Áp dụng cho các tháng sau
        </Checkbox>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setValues(initial)} disabled={!dirty || pending}>
            <RotateCcw className="size-4 transition-transform duration-500 group-hover:-rotate-180" aria-hidden />
            Hoàn tác
          </Button>
          <Button type="submit" disabled={pending || (!dirty && !applyToFollowing)} className="min-w-32">
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            Lưu ngân sách
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ViewSwitch({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  return (
    <div className="w-64">
      <Segmented label="Hiển thị" value={value} onChange={onChange} options={VIEW_OPTIONS} />
    </div>
  )
}

function BudgetTables({ comparison, month }: { comparison: BudgetComparison; month: number }) {
  const [incomeView, setIncomeView] = useState<View>('variance')
  const [spendingView, setSpendingView] = useState<View>('variance')

  function rowsFor<C extends (typeof INCOME_CATEGORIES)[number] | (typeof SPENDING_CATEGORIES)[number]>(
    categories: readonly C[],
    block: { planned: Record<C, number[]>; actual: Record<C, number[]>; variance: Record<C, number[]>; plannedTotal: number[]; actualTotal: number[]; varianceTotal: number[] },
    view: View,
    signed: TableRow['signed'],
  ): TableRow[] {
    const totals = { planned: block.plannedTotal, actual: block.actualTotal, variance: block.varianceTotal }[view]
    return [
      ...categories.map((c) => ({
        label: CATEGORY_META[c].label,
        dot: CATEGORY_META[c].color,
        values: block[view][c],
        total: sum(block[view][c]),
        format: 'money' as const,
        signed: view === 'variance' ? signed : undefined,
      })),
      {
        label: 'Tổng cộng',
        values: totals,
        total: sum(totals),
        format: 'money',
        strong: true,
        signed: view === 'variance' ? signed : undefined,
      },
    ]
  }

  const viewNote = (view: View, betterWhen: string) =>
    view === 'variance' ? `Chênh lệch = thực tế − dự kiến · ${betterWhen}` : 'Đơn vị: đồng'

  return (
    <>
      <MonthlyTable
        title="Thu nhập"
        description={viewNote(incomeView, 'số dương là thu vượt kế hoạch')}
        rows={rowsFor(INCOME_CATEGORIES, comparison.income, incomeView, 'good-up')}
        highlightMonth={month}
        action={<ViewSwitch value={incomeView} onChange={setIncomeView} />}
      />
      <MonthlyTable
        title="Chi tiêu"
        description={viewNote(spendingView, 'số dương là chi vượt ngân sách')}
        rows={rowsFor(SPENDING_CATEGORIES, comparison.spending, spendingView, 'good-down')}
        highlightMonth={month}
        action={<ViewSwitch value={spendingView} onChange={setSpendingView} />}
      />
      <MonthlyTable
        title="Tiết kiệm/Đầu tư"
        description="Chênh lệch = thực tế − dự kiến · số dương là vượt mục tiêu"
        highlightMonth={month}
        rows={[
          { label: 'Dự kiến', values: comparison.saving.planned, total: sum(comparison.saving.planned), format: 'money' },
          { label: 'Thực tế', values: comparison.saving.actual, total: sum(comparison.saving.actual), format: 'money' },
          {
            label: 'Chênh lệch',
            values: comparison.saving.variance,
            total: sum(comparison.saving.variance),
            format: 'money',
            strong: true,
            signed: 'good-up',
          },
        ]}
      />
    </>
  )
}
