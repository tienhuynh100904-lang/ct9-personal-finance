'use server'

import { refresh } from 'next/cache'
import { getSession } from '../auth'
import { validateItem, type FieldErrors, type ItemInput } from '../validation'
import { isUuid, type ActionResult } from './result'

const DUPLICATE_KEY = '23505'

export async function createItem(input: ItemInput): Promise<ActionResult<FieldErrors<ItemInput>>> {
  const { supabase, user } = await getSession()
  const parsed = validateItem(input)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }

  const { error } = await supabase.from('items').insert({ ...parsed.value, user_id: user.id })
  if (error) {
    if (error.code === DUPLICATE_KEY) {
      return { ok: false, error: 'Khoản mục này đã có trong danh mục.', fieldErrors: { name: 'Đã tồn tại.' } }
    }
    console.error('createItem failed', error)
    return { ok: false, error: 'Không thêm được khoản mục. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true, message: `Đã thêm “${parsed.value.name}”.` }
}

export async function updateItem(input: {
  id: string
  oldName: string
  item: ItemInput
  renameTransactions: boolean
}): Promise<ActionResult<FieldErrors<ItemInput>>> {
  const { supabase } = await getSession()
  if (!isUuid(input?.id) || typeof input.oldName !== 'string') {
    return { ok: false, error: 'Khoản mục không hợp lệ.' }
  }
  const parsed = validateItem(input.item)
  if (!parsed.ok) return { ok: false, error: 'Vui lòng kiểm tra lại thông tin.', fieldErrors: parsed.fieldErrors }
  const { kind, name, default_category } = parsed.value

  if (name !== input.oldName) {
    // Renames the item and its past transactions atomically (merges if the new name exists).
    const { error } = await supabase.rpc('rename_item', {
      p_kind: kind,
      p_old_name: input.oldName,
      p_new_name: name,
      p_update_transactions: input.renameTransactions === true,
    })
    if (error) {
      console.error('rename_item failed', error)
      return { ok: false, error: 'Không đổi tên được khoản mục. Vui lòng thử lại.' }
    }
  }

  const { error } = await supabase
    .from('items')
    .update({ default_category })
    .eq('kind', kind)
    .eq('name', name)
  if (error) {
    console.error('updateItem failed', error)
    return { ok: false, error: 'Không lưu được khoản mục. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true, message: 'Đã lưu khoản mục.' }
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const { supabase } = await getSession()
  if (!isUuid(id)) return { ok: false, error: 'Khoản mục không hợp lệ.' }

  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) {
    console.error('deleteItem failed', error)
    return { ok: false, error: 'Không xoá được khoản mục. Vui lòng thử lại.' }
  }

  refresh()
  return { ok: true, message: 'Đã xoá khỏi danh mục. Các giao dịch cũ vẫn được giữ nguyên.' }
}
