'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { validateTransaction, type FieldErrors, type TransactionInput } from '../validation'
import { isUuid, type ActionResult } from './result'

export async function saveTransaction(
  input: TransactionInput,
): Promise<ActionResult<FieldErrors<TransactionInput>>> {
  const { supabase, user } = await getSession()

  const parsed = validateTransaction(input)
  if (!parsed.ok) {
    return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }
  }

  const id = input?.id
  if (id !== undefined && !isUuid(id)) return { ok: false, error: 'Giao dịch không hợp lệ.' }

  const { data, error } = id
    ? await supabase.from('transactions').update(parsed.value).eq('id', id).select('id')
    : await supabase
        .from('transactions')
        .insert({ ...parsed.value, user_id: user.id })
        .select('id')

  if (error) {
    console.error('saveTransaction failed', error)
    return { ok: false, error: 'Không lưu được giao dịch. Vui lòng thử lại.' }
  }
  if (!data.length) return { ok: false, error: 'Không tìm thấy giao dịch cần sửa.' }

  refresh()
  return { ok: true }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Giao dịch không hợp lệ.' }

  const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('id')
  if (error) {
    console.error('deleteTransaction failed', error)
    return { ok: false, error: 'Không xoá được giao dịch. Vui lòng thử lại.' }
  }
  if (!data.length) return { ok: false, error: 'Giao dịch không còn tồn tại.' }

  refresh()
  return { ok: true }
}
