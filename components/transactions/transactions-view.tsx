'use client'

import { Download, Inbox, Scissors, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useOptimistic, useState, useTransition } from 'react'
import { MonthSwitcher, useMonthParam, type MonthValue } from '@/components/app/period'
import { ItemColumns } from '@/components/charts/item-columns'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import { setCutCandidates } from '@/lib/actions/transactions'
import { runAction } from '@/lib/run-action'
import { Segmented } from '@/components/ui/choice'
import { EmptyState } from '@/components/ui/empty-state'
import { Popover } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { CATEGORY_META, KIND_LABEL, MEASURE_COLOR } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { openComposer } from '@/lib/composer'
import { buildTransactionsCsv, csvFileName } from '@/lib/csv'
import { cutSummary, EXPENSE_CATEGORIES, INCOME_CATEGORIES, monthOf, topExpenseItems, type Category, type Kind } from '@/lib/finance'
import { formatDate, formatSignedVND, formatVND, formatWeekday, normalizeText } from '@/lib/format'
import type { TransactionRecord } from '@/lib/types'
import { CutSummaryCard } from './cut-summary'
import { ImportCsvDialog } from './import-csv-dialog'
import { TransactionRow } from './transaction-row'

const PAGE_SIZE = 120
/** `setCutCandidates` takes at most this many ids per call. */
const MARK_CHUNK = 500

function downloadCsv(rows: TransactionRecord[], kind: Kind, fileName: string) {
  const blob = new Blob([buildTransactionsCsv(rows, kind)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking right away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  toast.success(`Đã xuất ${KIND_LABEL[kind].toLowerCase()}`, {
    description: `${rows.filter((t) => t.kind === kind).length} giao dịch · ${fileName}`,
  })
}

export function TransactionsView({
  year,
  years,
  defaultMonth,
  current,
  transactions,
}: {
  year: number
  years: number[]
  defaultMonth: MonthValue
  /** This year and month in app time, for the "Hiện tại" button. */
  current: { year: number; month: number }
  transactions: TransactionRecord[]
}) {
  const [month, setMonth] = useMonthParam(defaultMonth)
  const [kind, setKind] = useState<'all' | Kind>('all')
  const [category, setCategory] = useState<'all' | Category>('all')
  const [item, setItem] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const filtersId = useId()

  // Next.js keeps this page mounted (hidden) when you navigate away: don't leave the panel open.
  useLayoutEffect(
    () => () => {
      setFiltersOpen(false)
      setReviewing(false)
    },
    [],
  )

  // "Muốn giảm" ticks show at once and are saved in the background (they revert on a failure).
  const [rows, applyMark] = useOptimistic(transactions, (state, change: { ids: Set<string>; value: boolean }) =>
    state.map((t) => (change.ids.has(t.id) ? { ...t, cut_candidate: change.value } : t)),
  )
  const [, startMark] = useTransition()
  // Older databases have no such column: the month-end review is then hidden.
  const cutAvailable = useMemo(() => transactions.some((t) => typeof t.cut_candidate === 'boolean'), [transactions])

  function mark(ids: string[], value: boolean) {
    if (ids.length === 0) return
    startMark(async () => {
      applyMark({ ids: new Set(ids), value })
      for (let i = 0; i < ids.length; i += MARK_CHUNK) {
        const result = await runAction(() => setCutCandidates(ids.slice(i, i + MARK_CHUNK), value))
        if (result && !result.ok) return void toast.error(result.error)
        if (!result) return
      }
    })
  }
  const [limit, setLimit] = useState(PAGE_SIZE)

  const inPeriod = useMemo(
    () => (month === 'all' ? rows : rows.filter((t) => monthOf(t.occurred_on) === month)),
    [rows, month],
  )

  // Everything except the item filter: the chart is drawn from this, so picking a bar does not collapse it to one bar.
  const matching = useMemo(() => {
    const q = normalizeText(query.trim())
    return inPeriod.filter(
      (t) =>
        (kind === 'all' || t.kind === kind) &&
        (category === 'all' || t.category === category) &&
        (!q || normalizeText(`${t.item} ${t.note ?? ''}`).includes(q)),
    )
  }, [inPeriod, kind, category, query])

  const itemTotals = useMemo(() => topExpenseItems(matching, year, { includeSaving: category === 'saving' }), [matching, year, category])
  // A picked item that is no longer in the chart (other month, other filters) stops filtering.
  const activeItem = item !== null && itemTotals.some((entry) => entry.item === item) ? item : null

  const filtered = useMemo(
    () => (activeItem === null ? matching : matching.filter((t) => t.kind === 'expense' && t.item === activeItem)),
    [matching, activeItem],
  )

  // The review looks at the whole period, whatever the search and filters show.
  const cut = useMemo(() => cutSummary(inPeriod), [inPeriod])
  const markable = useMemo(() => filtered.filter((t) => t.kind === 'expense' && t.category !== 'saving'), [filtered])
  const allMarked = markable.length > 0 && markable.every((t) => t.cut_candidate)

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
  const hasFilters = kind !== 'all' || category !== 'all' || query.trim() !== '' || activeItem !== null
  const activeFilters = (kind !== 'all' ? 1 : 0) + (category !== 'all' ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-auto">
          <MonthSwitcher year={year} month={month} onMonthChange={setMonth} years={years} current={current} allowAll stretch />
        </div>
        <div className="order-2 flex w-full gap-2 sm:order-none sm:w-auto sm:flex-1">
          <SearchInput
            label="Tìm kiếm"
            value={query}
            onValueChange={setQuery}
            placeholder="Tìm khoản mục, ghi chú…"
            className="sm:h-10 pointer-coarse:h-11"
            wrapperClassName="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            aria-label={activeFilters > 0 ? `Bộ lọc, ${activeFilters} đang bật` : 'Bộ lọc'}
            className={cn(
              'relative grid size-11 shrink-0 place-items-center rounded-xl border transition-colors sm:hidden',
              filtersOpen || activeFilters > 0
                ? 'border-brand-ink bg-brand-soft text-brand-ink'
                : 'border-field bg-surface text-ink-2 active:bg-surface-2',
            )}
          >
            <SlidersHorizontal className="size-5" aria-hidden />
            {activeFilters > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-semibold text-on-brand">
                {activeFilters}
              </span>
            ) : null}
          </button>
        </div>
        <div id={filtersId} className={cn(filtersOpen ? 'grid' : 'hidden', 'order-3 w-full gap-3 sm:order-none sm:contents')}>
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
              label="Lọc theo phân loại"
              value={category}
              onValueChange={(next) => setCategory(next as 'all' | Category)}
              options={[
                { value: 'all', label: 'Mọi phân loại' },
                ...categoryOptions.map((c) => ({ value: c, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color })),
              ]}
              triggerClassName="h-10 pointer-coarse:h-11"
            />
          </div>
        </div>
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

      {itemTotals.length > 0 ? (
        <Card>
          <CardHeader
            title="Chi tiêu theo khoản mục"
            description={
              <>
                <span className="max-sm:hidden">{periodLabel} · </span>
                bấm vào cột để lọc giao dịch
              </>
            }
            action={
              activeItem !== null ? (
                <Button variant="secondary" size="sm" onClick={() => setItem(null)}>
                  <X className="size-4" aria-hidden />
                  {activeItem}
                </Button>
              ) : null
            }
          />
          <CardBody className="pt-3 sm:pt-3">
            <ItemColumns
              items={itemTotals}
              color={MEASURE_COLOR.spending}
              selected={activeItem}
              onSelect={setItem}
              label={`Chi tiêu theo khoản mục, ${periodLabel}`}
            />
          </CardBody>
        </Card>
      ) : null}

      {cutAvailable && reviewing ? <CutSummaryCard summary={cut} periodLabel={periodLabel} /> : null}

      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-1)]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
          <p className="text-sm whitespace-nowrap text-muted">
            <span className="font-medium text-ink">{filtered.length}</span> giao dịch<span className="max-sm:hidden"> · {periodLabel}</span>
          </p>
          <div className="flex items-center gap-0.5 sm:gap-1">
          {cutAvailable ? (
            <Button variant={reviewing ? 'secondary' : 'ghost'} size="sm" aria-pressed={reviewing} onClick={() => setReviewing((on) => !on)}>
              <Scissors className="size-4" aria-hidden />
              {reviewing ? 'Xong' : 'Đánh giá'}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
            <span className="max-sm:sr-only">Nhập CSV</span>
          </Button>
          <Popover
            label="Xuất CSV"
            panelWidth={272}
            panelHeight={210}
            panelClassName="w-[17rem] max-w-[calc(100vw-2rem)]"
            trigger={({ open, ...props }) => (
              <Button variant="ghost" size="sm" disabled={filtered.length === 0} className={open ? 'bg-surface-2' : undefined} {...props}>
                <Download className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden />
                <span className="max-sm:sr-only">Xuất CSV</span>
              </Button>
            )}
          >
            {(close) => (
              <div className="p-2">
                <p className="px-2 pt-1 pb-2 text-sm font-medium">Xuất loại nào?</p>
                {(['income', 'expense'] as const).map((exportKind) => {
                  const count = filtered.filter((t) => t.kind === exportKind).length
                  return (
                    <button
                      key={exportKind}
                      type="button"
                      disabled={count === 0}
                      onClick={() => {
                        downloadCsv(filtered, exportKind, csvFileName(exportKind, year, month))
                        close()
                      }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-surface-2 active:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span className="text-sm font-medium">{KIND_LABEL[exportKind]}</span>
                      <span className="text-xs text-muted">{count} giao dịch</span>
                    </button>
                  )
                })}
                <p className="px-2 pt-2 pb-1 text-xs leading-snug text-muted">
                  Cột: Tên khoản mục, Ngày, Phân loại, Số tiền, Ghi chú — giống bảng trong Excel, dán thẳng vào được. Áp dụng theo
                  tháng và bộ lọc đang chọn.
                </p>
              </div>
            )}
          </Popover>
          </div>
        </div>

        {reviewing ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface-2/60 px-4 py-2.5 text-sm sm:px-5">
            <p className="text-ink-2">
              Tích các khoản chi bạn muốn giảm.{' '}
              <span className="font-medium text-ink">{cut.count > 0 ? `Đã chọn ${cut.count} khoản · ${formatVND(cut.amount)}` : 'Chưa chọn khoản nào'}</span>
            </p>
            {markable.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  mark(
                    markable.filter((t) => Boolean(t.cut_candidate) === allMarked).map((t) => t.id),
                    !allMarked,
                  )
                }
                className="inline-flex min-h-9 items-center font-medium text-brand-ink hover:underline pointer-coarse:min-h-11"
              >
                {allMarked ? 'Bỏ chọn' : 'Chọn'} cả {markable.length} khoản đang lọc
              </button>
            ) : null}
          </div>
        ) : null}

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
                    setItem(null)
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
                  <div className="sticky top-[var(--header-h)] z-10 flex items-center justify-between bg-surface/95 px-2 pt-4 pb-1.5 text-xs backdrop-blur sm:px-3">
                    <span className="font-semibold text-ink-2">
                      {formatWeekday(date)}, {formatDate(date)}
                    </span>
                    <span className={cn('tabular-nums', net < 0 ? 'text-muted' : 'text-positive')}>{formatSignedVND(net)}</span>
                  </div>
                  <ul>
                    {items.map((t) => (
                      <TransactionRow key={t.id} transaction={t} onCutChange={reviewing ? (checked) => mark([t.id], checked) : undefined} />
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

      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
