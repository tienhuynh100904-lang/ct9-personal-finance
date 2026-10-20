'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { todayISO } from '../dates'
import { maturityOf } from '../deposits'
import { isMissingColumn, isMissingTable } from '../supabase/errors'
import { validateDeposit, type DepositInput, type FieldErrors } from '../validation'
import { isUuid, type ActionResult } from './result'

const MISSING_TABLE_MESSAGE = 'Chưa bật tính năng khoản tiết kiệm. Hãy chạy lại supabase/schema.sql trong Supabase.'

function failure(error: { code?: string } | null, source: string, message: string): { ok: false; error: string } {
  if (isMissingTable(error) || isMissingColumn(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
  console.error(`${source} failed`, error)
  return { ok: false, error: message }
}

export async function saveDeposit(input: DepositInput): Promise<ActionResult<FieldErrors<DepositInput>>> {
  const { supabase, user } = await getSession()
  const parsed = validateDeposit(input)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const id = input?.id
  if (id !== undefined && !isUuid(id)) return { ok: false, error: 'Khoản tiết kiệm không hợp lệ.' }

  const { data, error } = id
    ? await supabase.from('savings_deposits').update(parsed.value).eq('id', id).select('id')
    : await supabase
        .from('savings_deposits')
        .insert({ ...parsed.value, user_id: user.id })
        .select('id')
  if (error) return failure(error, 'saveDeposit', 'Không lưu được khoản tiết kiệm. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Không tìm thấy khoản tiết kiệm cần sửa.' }

  refresh()
  return { ok: true }
}

/** "Tất toán": the deposit has been paid out. Nothing else changes: no transaction is created. */
export async function settleDeposit(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản tiết kiệm không hợp lệ.' }
  const { data, error } = await supabase.from('savings_deposits').update({ closed_on: todayISO() }).eq('id', id).is('closed_on', null).select('id')
  if (error) return failure(error, 'settleDeposit', 'Không cập nhật được. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Khoản tiết kiệm đã tất toán hoặc không còn tồn tại.' }
  refresh()
  return { ok: true }
}

/** Undo for "Tất toán". */
export async function reopenDeposit(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản tiết kiệm không hợp lệ.' }
  const { data, error } = await supabase.from('savings_deposits').update({ closed_on: null }).eq('id', id).select('id')
  if (error) return failure(error, 'reopenDeposit', 'Không hoàn tác được. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Khoản tiết kiệm không còn tồn tại.' }
  refresh()
  return { ok: true }
}

/**
 * "Tái tục": settles the deposit and opens a new one for the same name that starts on the old
 * maturity date, with the amount, rate and term the user chose (e.g. principal + interest).
 */
export async function renewDeposit(input: { id: string; principal: number; rate_bp: number; term_months: number }): Promise<ActionResult<FieldErrors<DepositInput>>> {
  const { supabase, user } = await getSession()
  const id = input?.id
  if (!isUuid(id)) return { ok: false, error: 'Khoản tiết kiệm không hợp lệ.' }

  const { data: old, error: readError } = await supabase
    .from('savings_deposits')
    .select('name, start_date, term_months, note, closed_on')
    .eq('id', id)
    .maybeSingle()
  if (readError) return failure(readError, 'renewDeposit (read)', 'Không tái tục được. Vui lòng thử lại.')
  if (!old) return { ok: false, error: 'Khoản tiết kiệm không còn tồn tại.' }
  if (old.closed_on) return { ok: false, error: 'Khoản tiết kiệm này đã tất toán.' }

  const parsed = validateDeposit({
    name: old.name,
    principal: input.principal,
    rate_bp: input.rate_bp,
    start_date: maturityOf(old),
    term_months: input.term_months,
    note: old.note,
  })
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const { data: created, error } = await supabase
    .from('savings_deposits')
    .insert({ ...parsed.value, user_id: user.id })
    .select('id')
    .single()
  if (error) return failure(error, 'renewDeposit', 'Không tái tục được. Vui lòng thử lại.')

  const { data: closed, error: closeError } = await supabase
    .from('savings_deposits')
    .update({ closed_on: todayISO() })
    .eq('id', id)
    .is('closed_on', null)
    .select('id')
  if (closeError || !closed?.length) {
    // Leave no duplicate behind: the old deposit is still open, so the new one must not exist.
    await supabase.from('savings_deposits').delete().eq('id', created.id)
    if (closeError) return failure(closeError, 'renewDeposit (close)', 'Không tái tục được. Vui lòng thử lại.')
    return { ok: false, error: 'Khoản tiết kiệm đã tất toán ở nơi khác.' }
  }

  refresh()
  return { ok: true }
}

export async function deleteDeposit(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản tiết kiệm không hợp lệ.' }
  const { data, error } = await supabase.from('savings_deposits').delete().eq('id', id).select('id')
  if (error) return failure(error, 'deleteDeposit', 'Không xoá được khoản tiết kiệm. Vui lòng thử lại.')
  if (!data.length) return { ok: false, error: 'Khoản tiết kiệm không còn tồn tại.' }
  refresh()
  return { ok: true }
}
