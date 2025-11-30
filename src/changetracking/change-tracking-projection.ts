import type { ChangeTrackingState } from './change-tracking-state'
import type { ChangeEvent } from '../events/change-tracking-events'
import type { LazyReviewerEvent } from '../events/events'
import { detectNewMrComments } from './mr-comments-projection'

interface ProjectionResult {
  changes: ChangeEvent[]
  newState: ChangeTrackingState
}

export function projectChangeTracking(
  state: ChangeTrackingState,
  event: LazyReviewerEvent
): ProjectionResult {
  const result = detectNewMrComments(state, event)

  // Merge updated comment IDs into state
  const newState: ChangeTrackingState = {
    mrCommentIds: new Map([
      ...state.mrCommentIds,
      ...result.updatedCommentIds
    ])
  }

  return {
    changes: result.changes,
    newState
  }
}
