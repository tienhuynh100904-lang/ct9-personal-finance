'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { cleanItemName } from '../items'
import { validateItem, type FieldErrors, type ItemInput } from '../validation'
import { isUuid, type ActionResult } from './result'

const DUPLICATE_KEY = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

type ItemResult = ActionResult<FieldErrors<ItemInput>> & { id?: string }

/** Adds an item to the list. Returns its id, so the entry form can select it right away. */
export async function createItem(input: ItemInput): Promise<ItemResult> {
  const { supabase, user } = await getSession()
  const parsed = validateItem(input)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const { data, error } = await supabase
    .from('items')
    .insert({ ...parsed.value, user_id: user.id })
    .select('id')
    .single()
  if (error) {
    if (error.code === DUPLICATE_KEY) {
      return { ok: false, error: 'Khoản mục này đã có trong danh mục.', fieldErrors: { name: 'Đã tồn tại.' } }
    }
    console.error('createItem failed', error)
    return { ok: false, error: 'Không thêm được khoản mục. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true, id: data.id, message: `Đã thêm “${parsed.value.name}”.` }
}

/**
 * Edits an item. Transactions follow it by id, so renaming changes their name too. A new name that
 * matches another item of the same kind merges the two: the transactions move to that other item.
 */
export async function updateItem(input: { id: string; item: ItemInput }): Promise<ItemResult & { merged?: boolean }> {
  const { supabase } = await getSession()
  if (!isUuid(input?.id)) return { ok: false, error: 'Khoản mục không hợp lệ.' }
  const parsed = validateItem(input.item)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }
  const { name, default_category } = parsed.value

  const { data: current, error: readError } = await supabase.from('items').select('name').eq('id', input.id).maybeSingle()
  if (readError) {
    console.error('updateItem (read) failed', readError)
    return { ok: false, error: 'Không lưu được khoản mục. Vui lòng thử lại.' }
  }
  if (!current) return { ok: false, error: 'Khoản mục không còn tồn tại.' }

  let id = input.id
  if (cleanItemName(current.name) !== name) {
    const { data, error } = await supabase.rpc('rename_item', { p_item_id: input.id, p_new_name: name })
    if (error) {
      console.error('rename_item failed', error)
      return { ok: false, error: 'Không đổi tên được khoản mục. Vui lòng thử lại.' }
    }
    id = data
  }

  const { error } = await supabase.from('items').update({ default_category }).eq('id', id)
  if (error) {
    console.error('updateItem failed', error)
    return { ok: false, error: 'Không lưu được khoản mục. Vui lòng thử lại.' }
  }

  refresh()
  const merged = id !== input.id
  return { ok: true, id, merged, message: merged ? `Đã gộp vào “${name}”.` : 'Đã lưu khoản mục.' }
}

/**
 * Removes an item nothing uses. One that transactions (or monthly rules) still point to is hidden
 * instead, so history keeps its names; it can be brought back with `restoreItem`.
 */
export async function deleteItem(id: string): Promise<ActionResult & { archived?: boolean }> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản mục không hợp lệ.' }

  const { error } = await supabase.from('items').delete().eq('id', id)
  if (!error) {
    refresh()
    return { ok: true, archived: false, message: 'Đã xoá khỏi danh mục.' }
  }
  if (error.code !== FOREIGN_KEY_VIOLATION) {
    console.error('deleteItem failed', error)
    return { ok: false, error: 'Không xoá được khoản mục. Vui lòng thử lại.' }
  }

  const { error: archiveError } = await supabase.from('items').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (archiveError) {
    console.error('deleteItem (archive) failed', archiveError)
    return { ok: false, error: 'Không ẩn được khoản mục. Vui lòng thử lại.' }
  }
  refresh()
  return { ok: true, archived: true, message: 'Khoản mục đã có giao dịch nên được ẩn. Các giao dịch cũ vẫn được giữ nguyên.' }
}

export async function restoreItem(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản mục không hợp lệ.' }

  const { error } = await supabase.from('items').update({ archived_at: null }).eq('id', id)
  if (error) {
    console.error('restoreItem failed', error)
    return { ok: false, error: 'Không hiện lại được khoản mục. Vui lòng thử lại.' }
  }
  refresh()
  return { ok: true, message: 'Đã hiện lại khoản mục.' }
}
