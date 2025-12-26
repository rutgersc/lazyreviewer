import { Atom } from "@effect-atom/atom-react"
import type { Action } from "./action-types"

export const paneActionsAtom = Atom.make<Action[]>([])
