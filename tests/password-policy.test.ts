import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPassword } from '../lib/password-policy.ts'

const failing = (password: string, email?: string) =>
  checkPassword(password, email)
    .rules.filter((r) => !r.ok)
    .map((r) => r.id)

test('a long mixed password with a symbol is strong', () => {
  const result = checkPassword('Vang-Bac-79xu!')
  assert.equal(result.strong, true)
  assert.equal(result.strength, 'strong')
  assert.deepEqual(failing('Vang-Bac-79xu!'), [])
})

test('an empty password is "empty", not weak, and nothing passes', () => {
  const result = checkPassword('')
  assert.equal(result.strength, 'empty')
  assert.equal(result.passed, 0)
  assert.equal(result.strong, false)
})

test('each missing character class is reported on its own', () => {
  assert.deepEqual(failing('vang-bac-79xu!'), ['upper'])
  assert.deepEqual(failing('VANG-BAC-79XU!'), ['lower'])
  assert.deepEqual(failing('Vang-Bac-xu!!x'), ['digit'])
  assert.deepEqual(failing('VangBac79xuTien'), ['symbol'])
  assert.deepEqual(failing('Va-79xu!'), ['length'])
})

test('Vietnamese letters count as upper and lower case', () => {
  assert.deepEqual(failing('Đồng-vàng-79!'), [])
})

test('guessable pieces fail the last rule', () => {
  assert.deepEqual(failing('Password-79xu!'), ['guessable'])
  assert.deepEqual(failing('Vang-1234-xu!A'), ['guessable'])
  assert.deepEqual(failing('Vang-dcba-79!X'), ['guessable'])
  assert.deepEqual(failing('Vang-aaa-79!Xu'), ['guessable'])
  assert.deepEqual(failing('Minh-Anh-79xu!', 'minh.anh@example.com'), [])
  assert.deepEqual(failing('Xu-minhanh-7!', 'minhanh@example.com'), ['guessable'])
})

test('strength climbs as rules pass', () => {
  assert.equal(checkPassword('abc').strength, 'weak')
  assert.equal(checkPassword('vangbac79x').strength, 'fair')
  assert.equal(checkPassword('Vangbac79xu').strength, 'good')
})
