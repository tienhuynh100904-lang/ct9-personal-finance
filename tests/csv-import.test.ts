import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTransactionsCsv } from '../lib/csv.ts'
import { parseAmountText, parseCategoryText, parseCsv, parseDateText, parseTransactionsCsv } from '../lib/csv-import.ts'
import type { TransactionRecord } from '../lib/types.ts'

const row = (over: Partial<TransactionRecord>): TransactionRecord => ({
  id: 'x',
  kind: 'expense',
  item: 'Ăn uống',
  category: 'essential',
  amount: 45000,
  occurred_on: '2026-10-05',
  note: null,
  created_at: '2026-10-05T01:00:00Z',
  ...over,
})

test('an export reads back to the same transactions', () => {
  const original = [
    row({ id: 'a', item: 'Cà phê', category: 'non_essential', amount: 30000, occurred_on: '2026-10-09' }),
    row({ id: 'b', item: 'Gửi tiết kiệm', category: 'saving', amount: 2_000_000, occurred_on: '2026-10-02', note: 'có "dấu", phẩy\nvà xuống dòng' }),
    row({ id: 'c', item: 'Nước', category: 'essential', amount: 120000, occurred_on: '2026-10-03', note: '=SUM(A1:A9)' }),
  ]
  const parsed = parseTransactionsCsv(buildTransactionsCsv(original, 'expense'))
  assert.equal(parsed.kind, 'expense')
  assert.equal(parsed.hasHeader, true)
  assert.ok(parsed.rows.every((r) => r.problems.length === 0))
  assert.deepEqual(
    parsed.rows.map((r) => [r.item, r.occurred_on, r.category, r.amount, r.note]),
    [
      ['Gửi tiết kiệm', '2026-10-02', 'saving', 2_000_000, 'có "dấu", phẩy\nvà xuống dòng'],
      ['Nước', '2026-10-03', 'essential', 120000, '=SUM(A1:A9)'],
      ['Cà phê', '2026-10-09', 'non_essential', 30000, ''],
    ],
  )
})

test('the date header tells income from expense', () => {
  const income = buildTransactionsCsv([row({ kind: 'income', category: 'main', item: 'Lương', amount: 6_300_000 })], 'income')
  assert.equal(parseTransactionsCsv(income).kind, 'income')
  assert.equal(parseTransactionsCsv(income).rows[0].category, 'main')
  assert.equal(parseTransactionsCsv('Tên khoản mục,Ngày,Phân loại,Số tiền\r\nX,2026-01-01,Thiết yếu,1\r\n').kind, null)
})

test('semicolon files, other line endings and reordered columns still import', () => {
  const text = 'Số tiền;Phân loại;Ngày chi;Tên khoản mục;Ghi chú\n"45.000";thiet yeu;13/10/2026;Ăn trưa;\n'
  const parsed = parseTransactionsCsv(text)
  assert.equal(parsed.kind, 'expense')
  assert.deepEqual(
    parsed.rows.map((r) => [r.item, r.occurred_on, r.category, r.amount]),
    [['Ăn trưa', '2026-10-13', 'essential', 45000]],
  )
})

test('a file without a header is read in the export order', () => {
  const parsed = parseTransactionsCsv('Cà phê,2026-10-09,Không thiết yếu,30000,\r\n')
  assert.equal(parsed.hasHeader, false)
  assert.equal(parsed.kind, null)
  assert.equal(parsed.rows[0].problems.length, 0)
  assert.equal(parsed.rows[0].line, 1)
})

test('problems are reported per row, with the file position', () => {
  const text = [
    'Tên khoản mục,Ngày chi,Phân loại,Số tiền,Ghi chú',
    ',2026-10-01,Thiết yếu,10000,',
    'A,31/02/2026,Thiết yếu,10000,',
    'B,2026-10-01,Du lịch,10000,',
    'C,2026-10-01,Thiết yếu,-5,',
    'D,2026-10-01,Thiết yếu,"12,5",',
    '',
    'E,2026-10-01,Thiết yếu,10000,ổn',
  ].join('\r\n')
  const parsed = parseTransactionsCsv(text)
  assert.equal(parsed.skippedBlank, 1)
  assert.deepEqual(parsed.rows.map((r) => [r.line, r.problems.length]), [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [8, 0]])
  assert.match(parsed.rows[1].problems[0], /Ngày/)
  assert.match(parsed.rows[2].problems[0], /Phân loại/)
  assert.match(parsed.rows[3].problems[0], /Số tiền/)
})

test('amounts, dates and categories are read forgivingly but never guessed', () => {
  for (const [text, value] of [['45000', 45000], ['45.000', 45000], ['45,000', 45000], ['1.250.000 ₫', 1250000], ['45000.00', 45000], ['45000đ', 45000]] as const) {
    assert.equal(parseAmountText(text), value, text)
  }
  for (const bad of ['', '-1', '12,5', '1.2.3', 'abc', '45.50']) assert.equal(parseAmountText(bad), null, bad)

  assert.equal(parseDateText('2026-10-13'), '2026-10-13')
  assert.equal(parseDateText('13/10/2026'), '2026-10-13')
  assert.equal(parseDateText('3/1/2026'), '2026-01-03')
  assert.equal(parseDateText('2026-10-13 08:30'), '2026-10-13')
  assert.equal(parseDateText('46308'), '2026-10-13')
  for (const bad of ['', '2026-13-01', '30/02/2026', '1999-01-01', 'hôm qua']) assert.equal(parseDateText(bad), null, bad)

  assert.equal(parseCategoryText('Tiết kiệm/Đầu tư'), 'saving')
  assert.equal(parseCategoryText(' THIẾT YẾU '), 'essential')
  assert.equal(parseCategoryText('tiet kiem/dau tu'), 'saving')
  assert.equal(parseCategoryText('non_essential'), 'non_essential')
  assert.equal(parseCategoryText('Thu nhập phụ'), 'side')
  assert.equal(parseCategoryText('Linh tinh'), null)
})

test('quoted cells keep separators, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""e""","f\r\ng"\r\n1,2,3,4'), [['a', 'b,c', 'd "e"', 'f\r\ng'], ['1', '2', '3', '4']])
  assert.deepEqual(parseCsv('﻿x;y\n1;2'), [['x', 'y'], ['1', '2']])
})
