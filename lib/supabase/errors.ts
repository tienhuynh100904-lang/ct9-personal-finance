/** PostgREST / Postgres codes for "this table does not exist" (schema not (re-)run yet). */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])

/** PostgreSQL "column does not exist": a column added by a newer schema.sql that has not been run yet. */
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703'
}

export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_TABLE_CODES.has(error.code))
}
