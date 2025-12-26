import type { ParsedKey } from '@opentui/core'
import type { KeyMatcher } from './action-types'

export const parseKeyString = (keyStr: string): KeyMatcher => {
  const parts = keyStr.toLowerCase().split('+')
  const name = parts.pop() || ''
  return {
    name,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta') || parts.includes('alt'),
    shift: parts.includes('shift'),
  }
}

export const matchesKey = (parsed: ParsedKey, matcher: KeyMatcher): boolean => {
  if (parsed.name !== matcher.name) return false
  if (matcher.ctrl && !parsed.ctrl) return false
  if (matcher.meta && !parsed.meta) return false
  if (matcher.shift && !parsed.shift) return false
  return true
}

export const matchesAnyKey = (parsed: ParsedKey, matchers: KeyMatcher[]): boolean =>
  matchers.some(matcher => matchesKey(parsed, matcher))
