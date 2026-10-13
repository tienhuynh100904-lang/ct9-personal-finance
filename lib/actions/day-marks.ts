'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { isValidISODate, todayISO } from '../dates'
import { addDays } from '../habit'
import { isMissingTable } from '../supabase/errors'
import type { ActionResult } from './result'

const MISSING_TABLE_MESSAGE = 'Chưa bật tính năng đánh dấu ngày. Hãy chạy lại supabase/schema.sql.'

/** Marks a day as "Không chi tiêu" so a frugal day keeps the logging streak alive. */
export async function markNoSpend(day: string): Promise<ActionResult> {
  const { supabase, user } = await getSession()
  if (typeof day !== 'string' || !isValidISODate(day)) return { ok: false, error: 'Ngày không hợp lệ.' }

  const today = todayISO()
  if (day > today) return { ok: false, error: 'Không thể đánh dấu ngày trong tương lai.' }
  if (day < addDays(today, -62)) return { ok: false, error: 'Chỉ đánh dấu được trong 2 tháng gần đây.' }

  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'expense')
    .eq('occurred_on', day)
  if (countError) {
    console.error('markNoSpend count failed', countError)
    return { ok: false, error: 'Không đánh dấu được. Vui lòng thử lại.' }
  }
  if ((count ?? 0) > 0) return { ok: false, error: 'Ngày này đã có khoản chi.' }

  const { error } = await supabase
    .from('day_marks')
    .upsert({ user_id: user.id, day, kind: 'no_spend' }, { onConflict: 'user_id,day', ignoreDuplicates: true })
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
    console.error('markNoSpend failed', error)
    return { ok: false, error: 'Không đánh dấu được. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true }
}

export async function unmarkNoSpend(day: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (typeof day !== 'string' || !isValidISODate(day)) return { ok: false, error: 'Ngày không hợp lệ.' }

  const { error } = await supabase.from('day_marks').delete().eq('day', day)
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MISSING_TABLE_MESSAGE }
    console.error('unmarkNoSpend failed', error)
    return { ok: false, error: 'Không bỏ đánh dấu được. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true }
}
