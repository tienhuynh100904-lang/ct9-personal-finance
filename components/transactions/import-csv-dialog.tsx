'use client'

import { ArrowDownLeft, ArrowUpRight, CircleAlert, CircleCheck, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/choice'
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { importTransactions, undoImport, type ImportRow } from '@/lib/actions/import'
import { CATEGORY_META, KIND_LABEL } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { buildTransactionsCsv } from '@/lib/csv'
import { MAX_IMPORT_ROWS, parseTransactionsCsv, type ImportCandidate, type ParsedCsv } from '@/lib/csv-import'
import { categoriesFor, isCategoryOf, type Kind } from '@/lib/finance'
import { formatDate, formatVND } from '@/lib/format'
import { runAction } from '@/lib/run-action'
import { afterDialogClose, toast } from '@/lib/toast'
import type { TransactionRecord } from '@/lib/types'
import { validateTransaction } from '@/lib/validation'

const MAX_FILE_BYTES = 1_000_000

/** The name of the date column in each kind of file: it is also how an exported file says which kind it is. */
const DATE_COLUMN: Record<Kind, string> = { income: 'Ngày nhận', expense: 'Ngày chi' }

/** Example rows for the "file mẫu" download: the same five columns as an export. */
const SAMPLE: Record<Kind, Pick<TransactionRecord, 'item' | 'category' | 'amount' | 'occurred_on' | 'note'>[]> = {
  expense: [
    { item: 'Ăn trưa', category: 'essential', amount: 45000, occurred_on: '2026-10-13', note: null },
    { item: 'Cà phê', category: 'non_essential', amount: 30000, occurred_on: '2026-10-13', note: 'Ghi chú không bắt buộc' },
  ],
  income: [{ item: 'Lương', category: 'main', amount: 10000000, occurred_on: '2026-10-05', note: null }],
}

function downloadSample(kind: Kind) {
  const rows = SAMPLE[kind].map((r, i) => ({ id: String(i), kind, created_at: '', ...r }))
  const url = URL.createObjectURL(new Blob([buildTransactionsCsv(rows, kind)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `mau-${kind === 'income' ? 'thu-nhap' : 'chi-tieu'}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

type Checked = { line: number; row: ImportRow } | { line: number; error: string }

/** Applies the same rules as saving a transaction by hand, and the chosen kind's own categories. */
function check(candidate: ImportCandidate, kind: Kind): Checked {
  if (candidate.problems.length > 0) return { line: candidate.line, error: candidate.problems[0] }
  const { category, amount, occurred_on } = candidate
  if (!category || amount === null || !occurred_on) return { line: candidate.line, error: 'Dòng chưa đầy đủ.' }
  const label = CATEGORY_META[category].label
  if (!isCategoryOf(kind, category)) {
    return { line: candidate.line, error: `Phân loại “${label}” không dùng cho ${KIND_LABEL[kind].toLowerCase()}.` }
  }
  const parsed = validateTransaction({ kind, item: candidate.item, category, amount, occurred_on, note: candidate.note })
  if (!parsed.ok) return { line: candidate.line, error: Object.values(parsed.fieldErrors)[0] ?? 'Dòng không hợp lệ.' }
  return { line: candidate.line, row: parsed.value }
}

/**
 * "Nhập CSV": choose what the file holds (Chi tiêu or Thu nhập), pick the file, review what will
 * happen, confirm. Nothing is saved before the confirmation.
 */
export function ImportCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nhập từ file CSV"
      description="Chọn loại giao dịch trong file, rồi chọn file. Bạn xem trước rồi mới xác nhận."
    >
      {open ? <ImportFlow onDone={onClose} /> : null}
    </Dialog>
  )
}

function ImportFlow({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>('expense')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Set<number> | null>(null)
  const [pending, startTransition] = useTransition()

  // An exported file names its kind in the date column; if that disagrees with the tab, say so
  // instead of importing income as spending (or the other way round).
  const mismatch = parsed?.kind && parsed.kind !== kind ? parsed.kind : null

  const checked = useMemo(() => (parsed && !mismatch ? parsed.rows.map((c) => check(c, kind)) : []), [parsed, mismatch, kind])
  const valid = useMemo(() => checked.flatMap((c) => ('row' in c ? [c.row] : [])), [checked])
  const errors = useMemo(() => checked.flatMap((c) => ('error' in c ? [c] : [])), [checked])

  // Which valid rows are already saved: asked of the server (a dry run), so the preview is honest.
  useEffect(() => {
    if (valid.length === 0) return
    let stale = false
    void runAction(() => importTransactions({ rows: valid, dryRun: true })).then((result) => {
      if (stale || !result) return
      setDuplicates(result.ok ? new Set(result.duplicates ?? []) : new Set())
      if (!result.ok) toast.error(result.error)
    })
    return () => {
      stale = true
      setDuplicates(null)
    }
  }, [valid])

  async function readFile(file: File | undefined) {
    if (!file) return
    setFileError(null)
    setParsed(null)
    setFileName(file.name)
    if (file.size > MAX_FILE_BYTES) return setFileError('File quá lớn (tối đa 1 MB). Hãy chia nhỏ file rồi nhập từng phần.')
    const text = await file.text()
    if (text.includes('�')) {
      return setFileError('Không đọc được chữ tiếng Việt trong file. Hãy lưu lại dạng “CSV UTF-8” rồi chọn lại.')
    }
    const result = parseTransactionsCsv(text)
    if (result.rows.length === 0) return setFileError('Không thấy dòng dữ liệu nào trong file.')
    if (result.rows.length > MAX_IMPORT_ROWS) {
      return setFileError(`File có ${result.rows.length} dòng; mỗi lần nhập tối đa ${MAX_IMPORT_ROWS}. Hãy chia nhỏ file.`)
    }
    setParsed(result)
  }

  function reset() {
    setParsed(null)
    setFileError(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const toImport = valid.filter((_, i) => !duplicates?.has(i))
  const duplicateCount = valid.length - toImport.length
  const total = toImport.reduce((sum, r) => sum + r.amount, 0)
  const dates = toImport.map((r) => r.occurred_on).sort()
  const ready = parsed !== null && !mismatch && duplicates !== null && toImport.length > 0
  const dateColumn = DATE_COLUMN[kind]

  function submit() {
    if (!ready) return
    startTransition(async () => {
      const result = await runAction(() => importTransactions({ rows: valid }))
      if (!result) return
      if (!result.ok) return void toast.error(result.error)
      const ids = result.ids ?? []
      const skipped = result.duplicates?.length ?? 0
      onDone()
      afterDialogClose(() =>
        toast.success(`Đã nhập ${result.inserted ?? 0} ${KIND_LABEL[kind].toLowerCase()}`, {
          description: skipped > 0 ? `${skipped} dòng trùng với dữ liệu sẵn có đã được bỏ qua.` : undefined,
          action:
            ids.length > 0
              ? {
                  label: 'Hoàn tác',
                  onClick: () => {
                    void runAction(() => undoImport(ids)).then((undo) => {
                      if (!undo) return
                      if (undo.ok) toast.success('Đã hoàn tác', { description: `Đã xoá ${undo.removed ?? ids.length} giao dịch vừa nhập.` })
                      else toast.error(undo.error)
                    })
                  },
                }
              : undefined,
        }),
      )
    })
  }

  return (
    <>
      <DialogBody className="space-y-4">
        <input ref={inputRef} id="import-csv-file" type="file" accept=".csv,text/csv,text/plain" className="peer sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />

        <div>
          <Segmented
            label="Loại giao dịch trong file"
            value={kind}
            onChange={setKind}
            options={[
              {
                value: 'expense',
                label: (
                  <>
                    <ArrowUpRight className="size-4 text-expense" aria-hidden /> Chi tiêu
                  </>
                ),
              },
              {
                value: 'income',
                label: (
                  <>
                    <ArrowDownLeft className="size-4 text-positive" aria-hidden /> Thu nhập
                  </>
                ),
              },
            ]}
          />
        </div>

        {parsed === null ? (
          <>
            <label
              htmlFor="import-csv-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2/50 px-4 py-8 text-center transition-colors hover:border-brand-edge hover:bg-brand-soft peer-focus-visible:border-focus peer-focus-visible:ring-3 peer-focus-visible:ring-focus/25"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
                <Upload className="icon-float size-6" aria-hidden />
              </span>
              <span className="text-sm font-semibold">Chọn file CSV {KIND_LABEL[kind].toLowerCase()}</span>
              <span className="text-xs text-muted">{fileName || 'Bấm để chọn file từ máy'}</span>
            </label>

            {fileError ? (
              <p role="alert" className="auth-shake flex items-start gap-2 rounded-xl bg-negative/10 px-3 py-2.5 text-sm font-medium text-negative">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {fileError}
              </p>
            ) : null}

            <section className="rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-ink-2" aria-labelledby="csv-format-title">
              <h3 id="csv-format-title" className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <FileSpreadsheet className="size-4 text-brand-ink" aria-hidden />
                File {KIND_LABEL[kind].toLowerCase()} cần có dạng
              </h3>
              <p className="mt-1.5">
                5 cột, dòng đầu là tiêu đề: <strong className="font-semibold text-ink">Tên khoản mục · {dateColumn} · Phân loại · Số tiền · Ghi chú</strong>.
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4">
                <li>
                  Phân loại là một trong: <strong className="font-semibold text-ink">{categoriesFor(kind).map((c) => CATEGORY_META[c].label).join(', ')}</strong>.
                </li>
                <li>Ngày dạng 2026-10-13 hoặc 13/10/2026.</li>
                <li>Số tiền là số nguyên, đơn vị đồng (45000 hoặc 45.000).</li>
              </ul>
              <p className="mt-2">
                <button type="button" onClick={() => downloadSample(kind)} className="font-medium text-brand-ink underline-offset-2 hover:underline">
                  Tải file mẫu {KIND_LABEL[kind].toLowerCase()}
                </button>
              </p>
            </section>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4 shrink-0 text-brand-ink" aria-hidden />
                <span className="min-w-0 truncate font-medium">{fileName}</span>
              </p>
              <button type="button" onClick={reset} className="shrink-0 text-sm font-medium text-brand-ink hover:underline">
                Chọn file khác
              </button>
            </div>

            {mismatch ? (
              <div role="alert" className="rounded-2xl border border-[color-mix(in_oklab,var(--s-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--s-warning)_12%,var(--surface))] p-3.5">
                <p className="flex items-start gap-2 text-sm font-medium text-ink">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>
                    File này có cột “{DATE_COLUMN[mismatch]}” nên là <strong>{KIND_LABEL[mismatch].toLowerCase()}</strong>, nhưng bạn đang chọn{' '}
                    <strong>{KIND_LABEL[kind].toLowerCase()}</strong>.
                  </span>
                </p>
                <Button size="sm" className="mt-2.5" onClick={() => setKind(mismatch)}>
                  Chuyển sang {KIND_LABEL[mismatch]}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat tone="good" label={duplicates ? 'Sẽ nhập' : 'Đang kiểm tra'} value={duplicates ? toImport.length : valid.length} />
                  <Stat tone={duplicateCount > 0 ? 'muted' : 'none'} label="Trùng, bỏ qua" value={duplicates ? duplicateCount : '…'} />
                  <Stat tone={errors.length > 0 ? 'bad' : 'none'} label="Dòng lỗi" value={errors.length} />
                </div>

                {toImport.length > 0 ? (
                  <p className="text-sm text-ink-2">
                    <strong className="font-semibold text-ink">{KIND_LABEL[kind]}</strong> · tổng{' '}
                    <strong className="font-semibold text-ink tabular-nums">{formatVND(total)}</strong>
                    {dates.length > 0 ? ` · từ ${formatDate(dates[0])} đến ${formatDate(dates.at(-1)!)}` : ''}
                  </p>
                ) : null}

                {errors.length > 0 ? (
                  <section aria-labelledby="csv-errors-title" className="rounded-2xl border border-[color-mix(in_oklab,var(--s-critical)_30%,transparent)] bg-negative/5 p-3">
                    <h3 id="csv-errors-title" className="text-sm font-semibold text-negative">
                      {errors.length} dòng sẽ bị bỏ qua vì lỗi
                    </h3>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink-2">
                      {errors.slice(0, 6).map((e) => (
                        <li key={e.line}>
                          <span className="font-semibold text-ink">Dòng {e.line}:</span> {e.error}
                        </li>
                      ))}
                      {errors.length > 6 ? <li className="text-muted">… và {errors.length - 6} dòng lỗi khác.</li> : null}
                    </ul>
                  </section>
                ) : null}

                {toImport.length > 0 ? (
                  <section aria-labelledby="csv-sample-title">
                    <h3 id="csv-sample-title" className="mb-1.5 text-xs font-medium text-muted">
                      Xem trước {Math.min(5, toImport.length)}/{toImport.length} dòng
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {toImport.slice(0, 5).map((r, i) => (
                        <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[r.category].color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{r.item}</span>
                            <span className="block truncate text-xs text-muted">
                              {formatDate(r.occurred_on)} · {CATEGORY_META[r.category].label}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">{formatVND(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : duplicates !== null && valid.length > 0 ? (
                  <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                    Mọi dòng hợp lệ đều đã có trong app, nên không có gì để nhập thêm.
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button size="lg" className="w-full" disabled={!ready || pending} onClick={submit}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {ready
            ? `Nhập ${toImport.length} ${KIND_LABEL[kind].toLowerCase()}`
            : mismatch
              ? 'Chọn đúng loại để nhập'
              : parsed
                ? 'Chưa có dòng nào để nhập'
                : 'Chọn file để bắt đầu'}
        </Button>
      </DialogFooter>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'good' | 'bad' | 'muted' | 'none' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <p
        className={cn(
          'text-xl font-semibold tabular-nums',
          tone === 'good' && 'text-positive',
          tone === 'bad' && 'text-negative',
          (tone === 'muted' || tone === 'none') && 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  )
}
