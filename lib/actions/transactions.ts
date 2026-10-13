'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { isMissingTable } from '../supabase/errors'
import { validateTransaction, type FieldErrors, type TransactionInput } from '../validation'
import { isUuid, type ActionResult } from './result'


export async function saveTransaction(
  input: TransactionInput,
): Promise<ActionResult<FieldErrors<TransactionInput>> & { id?: string; clearedMark?: boolean }> {
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

  // An expense means the day was not a "no spend" day: drop the mark (best effort), and
  // tell the caller so that "Hoàn tác" can put the mark back.
  let clearedMark = false
  if (parsed.value.kind === 'expense') {
    const { data: removed, error: markError } = await supabase
      .from('day_marks')
      .delete()
      .eq('day', parsed.value.occurred_on)
      .select('day')
    if (markError) {
      if (!isMissingTable(markError)) console.error('clearing day mark failed', markError)
    } else {
      clearedMark = removed.length > 0
    }
  }

  refresh()
  return { ok: true, id: data[0].id, clearedMark }
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
