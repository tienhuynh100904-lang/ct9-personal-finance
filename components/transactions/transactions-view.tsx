'use client'

import { Download, Inbox, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MonthSwitcher, useMonthParam, type MonthValue } from '@/components/app/period'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/choice'
import { EmptyState } from '@/components/ui/empty-state'
import { inputClasses, Select } from '@/components/ui/field'
import { CATEGORY_META, KIND_LABEL } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, monthOf, type Category, type Kind } from '@/lib/finance'
import { formatDate, formatSignedVND, formatVND, formatWeekday } from '@/lib/format'
import type { TransactionRecord } from '@/lib/types'
import { TransactionRow } from './transaction-row'

const PAGE_SIZE = 120

/** Case- and accent-insensitive: "an uong" finds "Ăn uống". */
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: TransactionRecord[], fileName: string) {
  const header = ['Ngày', 'Loại', 'Khoản mục', 'Phân loại', 'Số tiền', 'Ghi chú']
  const lines = rows.map((t) =>
    [formatDate(t.occurred_on), KIND_LABEL[t.kind], t.item, CATEGORY_META[t.category].label, t.amount, t.note ?? '']
      .map(csvCell)
      .join(','),
  )
  // The BOM makes Excel open the UTF-8 file with Vietnamese characters intact.
  const blob = new Blob([`﻿${[header.join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function TransactionsView({
  year,
  years,
  defaultMonth,
  transactions,
}: {
  year: number
  years: number[]
  defaultMonth: MonthValue
  transactions: TransactionRecord[]
}) {
  const [month, setMonth] = useMonthParam(defaultMonth)
  const [kind, setKind] = useState<'all' | Kind>('all')
  const [category, setCategory] = useState<'all' | Category>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const inPeriod = useMemo(
    () => (month === 'all' ? transactions : transactions.filter((t) => monthOf(t.occurred_on) === month)),
    [transactions, month],
  )

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return inPeriod.filter(
      (t) =>
        (kind === 'all' || t.kind === kind) &&
        (category === 'all' || t.category === category) &&
        (!q || normalize(`${t.item} ${t.note ?? ''}`).includes(q)),
    )
  }, [inPeriod, kind, category, query])

  const totals = useMemo(() => {
    let income = 0
    let spending = 0
    let saving = 0
    for (const t of filtered) {
      if (t.kind === 'income') income += t.amount
      else if (t.category === 'saving') saving += t.amount
      else spending += t.amount
    }
    return { income, spending, saving, balance: income - spending - saving }
  }, [filtered])

  const groups = useMemo(() => {
    const byDate = new Map<string, TransactionRecord[]>()
    for (const t of filtered.slice(0, limit)) {
      const list = byDate.get(t.occurred_on)
      if (list) list.push(t)
      else byDate.set(t.occurred_on, [t])
    }
    return [...byDate.entries()]
  }, [filtered, limit])

  const categoryOptions: Category[] =
    kind === 'income' ? [...INCOME_CATEGORIES] : kind === 'expense' ? [...EXPENSE_CATEGORIES] : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
  const periodLabel = month === 'all' ? `năm ${year}` : `tháng ${month}/${year}`
  const hasFilters = kind !== 'all' || category !== 'all' || query.trim() !== ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonthSwitcher year={year} month={month} onMonthChange={setMonth} years={years} allowAll />
        <div className="w-full sm:w-64">
          <Segmented
            label="Loại giao dịch"
            value={kind}
            onChange={(value) => {
              setKind(value)
              setCategory('all')
            }}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'expense', label: 'Chi' },
              { value: 'income', label: 'Thu' },
            ]}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Lọc theo phân loại"
            value={category}
            onChange={(e) => setCategory(e.target.value as 'all' | Category)}
            className="h-10"
          >
            <option value="all">Mọi phân loại</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </div>
        <label className="relative w-full sm:w-auto sm:flex-1">
          <span className="sr-only">Tìm kiếm</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm khoản mục, ghi chú…"
            className={cn(inputClasses, 'h-10 pl-9')}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {[
          { label: 'Thu nhập', value: formatVND(totals.income), color: 'var(--c-income)' },
          { label: 'Chi tiêu', value: formatVND(totals.spending), color: 'var(--c-expense)' },
          { label: 'Tiết kiệm/Đầu tư', value: formatVND(totals.saving), color: 'var(--c-saving)' },
          {
            label: 'Còn lại',
            value: totals.balance < 0 ? formatSignedVND(totals.balance) : formatVND(totals.balance),
            negative: totals.balance < 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              {stat.color ? <span aria-hidden className="size-2 rounded-[2px]" style={{ background: stat.color }} /> : null}
              {stat.label}
            </p>
            <p className={cn('mt-0.5 font-semibold', stat.negative && 'text-negative')}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{filtered.length}</span> giao dịch · {periodLabel}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadCsv(filtered, `thu-chi-${year}${month === 'all' ? '' : `-${String(month).padStart(2, '0')}`}.csv`)
            }
          >
            <Download className="size-4" aria-hidden />
            Xuất CSV
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={hasFilters ? 'Không có giao dịch phù hợp' : `Chưa có giao dịch ${periodLabel}`}
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setKind('all')
                    setCategory('all')
                    setQuery('')
                  }}
                >
                  Xoá bộ lọc
                </Button>
              ) : (
                <Button onClick={() => openComposer()}>Thêm giao dịch</Button>
              )
            }
          >
            {hasFilters ? 'Thử đổi bộ lọc hoặc từ khoá tìm kiếm.' : 'Bấm “Thêm giao dịch” để ghi khoản thu hoặc chi đầu tiên.'}
          </EmptyState>
        ) : (
          <div className="px-2 pb-2 sm:px-3">
            {groups.map(([date, items]) => {
              const net = items.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)
              return (
                <section key={date} aria-label={formatDate(date)}>
                  <div className="sticky top-14 z-10 flex items-center justify-between bg-surface/95 px-2 pt-4 pb-1.5 text-xs backdrop-blur sm:px-3 lg:top-0">
                    <span className="font-semibold text-ink-2">
                      {formatWeekday(date)}, {formatDate(date)}
                    </span>
                    <span className={cn('tabular-nums', net < 0 ? 'text-muted' : 'text-positive')}>{formatSignedVND(net)}</span>
                  </div>
                  <ul>
                    {items.map((t) => (
                      <TransactionRow key={t.id} transaction={t} />
                    ))}
                  </ul>
                </section>
              )
            })}
            {filtered.length > limit ? (
              <div className="flex justify-center py-3">
                <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  Hiển thị thêm ({filtered.length - limit})
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
