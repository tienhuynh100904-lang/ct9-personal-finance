/**
 * Rules a new password must pass. Shared by the forms (live checklist) and the Server Actions
 * (which enforce it again, so the browser check can't be skipped). Pure: no DOM, no server APIs.
 */

export const PASSWORD_MIN_LENGTH = 10

/** Words and patterns people reach for first; checked case-insensitively as substrings. */
const COMMON_PASSWORDS = ['password', 'passw0rd', 'matkhau', 'qwerty', 'asdfgh', 'admin', 'iloveyou', 'welcome', 'abc123', 'ct9finance']

export type PasswordRuleId = 'length' | 'lower' | 'upper' | 'digit' | 'symbol' | 'guessable'

export type PasswordRuleResult = { id: PasswordRuleId; label: string; ok: boolean }

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

export type PasswordCheck = {
  rules: PasswordRuleResult[]
  /** How many rules pass (0 to rules.length). */
  passed: number
  strength: PasswordStrength
  /** Every rule passes: the only state in which the password may be saved. */
  strong: boolean
}

/** Four or more consecutive letters or digits in order, either direction: "1234", "abcd", "9876". */
function hasRun(value: string): boolean {
  const s = value.toLowerCase()
  for (let i = 0; i + 3 < s.length; i++) {
    const codes = [0, 1, 2, 3].map((k) => s.charCodeAt(i + k))
    if (!codes.every((c) => (c >= 48 && c <= 57) || (c >= 97 && c <= 122))) continue
    const step = codes[1] - codes[0]
    if ((step === 1 || step === -1) && codes[2] - codes[1] === step && codes[3] - codes[2] === step) return true
  }
  return false
}

/** True when the password contains something an attacker would try early. */
function isGuessable(password: string, email?: string | null): boolean {
  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.some((word) => lower.includes(word))) return true
  if (/(.)\1\1/.test(password)) return true // "aaa", "111"
  if (hasRun(password)) return true
  const name = email?.split('@')[0]?.toLowerCase() ?? ''
  return name.length >= 3 && lower.includes(name)
}

export function checkPassword(password: string, email?: string | null): PasswordCheck {
  const rules: PasswordRuleResult[] = [
    { id: 'length', label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`, ok: [...password].length >= PASSWORD_MIN_LENGTH },
    { id: 'lower', label: 'Có chữ thường (a–z)', ok: /\p{Ll}/u.test(password) },
    { id: 'upper', label: 'Có chữ hoa (A–Z)', ok: /\p{Lu}/u.test(password) },
    { id: 'digit', label: 'Có chữ số (0–9)', ok: /\p{Nd}/u.test(password) },
    { id: 'symbol', label: 'Có ký tự đặc biệt (! @ # $ …)', ok: /[^\p{L}\p{N}\s]/u.test(password) },
    {
      id: 'guessable',
      label: 'Không có chuỗi dễ đoán (1234, aaa, password, tên email)',
      ok: password.length > 0 && !isGuessable(password, email),
    },
  ]
  const passed = rules.filter((r) => r.ok).length
  const strong = passed === rules.length
  const strength: PasswordStrength =
    password.length === 0 ? 'empty' : strong ? 'strong' : passed >= rules.length - 1 ? 'good' : passed >= 3 ? 'fair' : 'weak'
  return { rules, passed, strength, strong }
}
