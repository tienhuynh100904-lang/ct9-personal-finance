import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanItemName, itemKey, withItemName } from '../lib/items.ts'

test('cleanItemName trims and collapses spaces', () => {
  assert.equal(cleanItemName('  Cà   phê \t sáng '), 'Cà phê sáng')
})

test('itemKey ignores case and spacing, not accents', () => {
  assert.equal(itemKey('Cà  phê'), itemKey(' cà phê '))
  assert.equal(itemKey('ĂN UỐNG'), itemKey('ăn uống'))
  assert.notEqual(itemKey('Cà phê'), itemKey('Ca phe'))
})

test('itemKey treats composed and decomposed accents as the same', () => {
  assert.equal(itemKey('Cà phê'), itemKey('Cà phê'.normalize('NFD')))
})

test('withItemName flattens the joined item into `item`', () => {
  assert.deepEqual(withItemName({ id: 'a', amount: 5, items: { name: 'Ăn uống' } }), { id: 'a', amount: 5, item: 'Ăn uống' })
  assert.deepEqual(withItemName({ id: 'b', items: null }), { id: 'b', item: '' })
})
