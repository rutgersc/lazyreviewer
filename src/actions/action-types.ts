export interface KeyMatcher {
  name: string
  ctrl: boolean
  shift: boolean
  meta: boolean
}

export interface Action {
  id: string
  keys: KeyMatcher[]
  displayKey: string
  description: string
  handler: () => void | Promise<void>
}
