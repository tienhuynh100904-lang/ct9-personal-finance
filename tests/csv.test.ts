import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTransactionsCsv, csvFileName } from '../lib/csv.ts'
import type { TransactionRecord } from '../lib/types.ts'

const row = (over: Partial<TransactionRecord>): TransactionRecord => ({
  id: 'x',
  kind: 'expense',
  item_id: 'item-1',
  item: 'Ăn uống',
  category: 'essential',
  amount: 45000,
  occurred_on: '2026-10-05',
  note: null,
  created_at: '2026-10-05T01:00:00Z',
  ...over,
})

test('one kind only, five columns that match the workbook, oldest first', () => {
  const csv = buildTransactionsCsv(
    [
      row({ id: 'a', occurred_on: '2026-10-09', item: 'Cà phê' }),
      row({ id: 'b', kind: 'income', category: 'main', item: 'Lương', amount: 6300000, occurred_on: '2026-10-01' }),
      row({ id: 'c', occurred_on: '2026-10-02', note: 'có "dấu", phẩy' }),
    ],
    'expense',
  )
  const lines = csv.replace('﻿', '').trimEnd().split('\r\n')
  assert.ok(!csv.includes('sep='))
  assert.equal(lines[0], 'Tên khoản mục,Ngày chi,Phân loại,Số tiền,Ghi chú')
  assert.equal(lines.length, 3)
  assert.ok(lines[1].startsWith('Ăn uống,2026-10-02,'))
  assert.ok(lines[1].endsWith(',45000,"có ""dấu"", phẩy"'))
  assert.ok(lines[2].startsWith('Cà phê,2026-10-09,'))
  assert.equal(lines[0].split(',').length, 5)
})

test('income export uses the income date header', () => {
  const csv = buildTransactionsCsv([row({ kind: 'income', category: 'main', item: 'Lương', amount: 1 })], 'income')
  assert.ok(csv.includes('Tên khoản mục,Ngày nhận,Phân loại,Số tiền,Ghi chú'))
  assert.ok(!csv.includes('Loại'))
})

test('text that looks like a formula is neutralised', () => {
  const csv = buildTransactionsCsv([row({ note: '=SUM(A1:A9)' })], 'expense')
  assert.ok(csv.includes("'=SUM(A1:A9)"))
})

test('file names carry kind and period', () => {
  assert.equal(csvFileName('income', 2026, 10), 'thu-nhap-2026-10.csv')
  assert.equal(csvFileName('expense', 2026, 'all'), 'chi-tieu-2026.csv')
})
