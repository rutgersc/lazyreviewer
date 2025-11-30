import { Result, Atom } from '@effect-atom/atom-react'
import type { ChangeEvent } from '../events/change-tracking-events'
import { allMrsAtom } from '../mergerequests/mergerequests-atom'
import type { DiscussionNote, Discussion } from '../gitlab/gitlab-schema'

export function formatChange(change: ChangeEvent, get: Atom.Context): string {
  // Look up MR from allMrsAtom read model using change.mrId
  const allMrsResult = get(allMrsAtom)
  const allMrsState = Result.match(allMrsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (state) => state.value
  })

  if (!allMrsState) {
    return `[NEW MR COMMENT] MR: ${change.mrId}, Note: ${change.noteId} (allMrs not loaded)`
  }

  const mr = allMrsState.mrsByGid.get(change.mrId)
  if (!mr) {
    return `[NEW MR COMMENT] MR: ${change.mrId}, Note: ${change.noteId} (MR not found)`
  }

  // Find note in MR discussions
  const note = mr.discussions
    .flatMap((d: Discussion) => d.notes)
    .find((n: DiscussionNote) => n.id === change.noteId)

  if (!note) {
    return `[NEW MR COMMENT] !${mr.iid} - ${mr.title} - Note: ${change.noteId} (note not found)`
  }

  const preview = note.body.length > 100
    ? note.body.substring(0, 100) + '...'
    : note.body

  return `[NEW MR COMMENT] !${mr.iid} - ${mr.title} - ${note.author} commented: "${preview}"`
}
