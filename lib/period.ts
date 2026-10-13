import 'server-only'

import { connection } from 'next/server'
import { currentYearMonth, parseYear } from './dates'
import { monthOf, yearOf, type Txn } from './finance'

type SearchParams = Record<string, string | string[] | undefined>

/** Reads `?nam=` and today's date (Vietnam time) for the current request. */
export async function resolveYear(searchParams: Promise<SearchParams>) {
  const params = await searchParams
  await connection()
  const today = currentYearMonth()
  const year = parseYear(params.nam) ?? today.year
  return { year, today }
}

/** The month a page opens on: this month for the current year, otherwise the latest month with data. */
export function defaultMonthFor(year: number, today: { year: number; month: number }, txns: readonly Txn[]): number {
  if (year === today.year) return today.month
  let latest = 0
  for (const t of txns) {
    if (yearOf(t.occurred_on) === year) latest = Math.max(latest, monthOf(t.occurred_on))
  }
  return latest || (year < today.year ? 12 : 1)
}
