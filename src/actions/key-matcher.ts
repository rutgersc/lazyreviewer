import type { ParsedKey } from '@opentui/core'
import type { KeyMatcher } from './action-types'

export const parseKeyString = (keyStr: string): KeyMatcher => {
  const parts = keyStr.split('+')
  const raw = parts.pop() || ''
  const isShiftedLetter = raw.length === 1 && raw >= 'A' && raw <= 'Z'
  const name = raw.toLowerCase()
  const modifiers = parts.map(p => p.toLowerCase())
  return {
    name,
    ctrl: modifiers.includes('ctrl'),
    meta: modifiers.includes('meta') || modifiers.includes('alt'),
    shift: modifiers.includes('shift') || isShiftedLetter,
  }
}

const matchesKey = (parsed: ParsedKey, matcher: KeyMatcher): boolean => {
  if (matcher.name !== parsed.name) return false
  if (matcher.ctrl !== parsed.ctrl) return false
  if (matcher.meta !== parsed.meta) return false
  if (matcher.shift !== parsed.shift) return false
  return true
}

export const matchesAnyKey = (parsed: ParsedKey, matchers: KeyMatcher[]): boolean =>
  matchers.some(matcher => matchesKey(parsed, matcher))
