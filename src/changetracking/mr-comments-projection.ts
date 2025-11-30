import type { GitlabMergeRequest, DiscussionNote } from '../gitlab/gitlab-schema'
import type { ChangeTrackingState } from './change-tracking-state'
import type { ChangeEvent } from '../events/change-tracking-events'
import type { LazyReviewerEvent } from '../events/events'
import type {
  GitlabUserMergeRequestsFetchedEvent,
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from '../events/gitlab-events'
import {
  projectGitlabUserMrsFetchedEvent,
  projectGitlabProjectMrsFetchedEvent,
  projectGitlabSingleMrFetchedEvent
} from '../gitlab/gitlab-projections'

/**
 * Union of events that contain MR discussions
 */
type MrDiscussionsEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent

/**
 * Represents an MR with all its discussions
 */
// flattened from discussions
type MrDiscussionsByMrId = Map<string, Set<string>>

/**
 * Diff information for a single MR - only what changed
 */
interface MrCommentDiff {
  mrId: string
  newNoteIds: Set<string>   // Only the IDs that are new (not in previous state)
}

/**
 * Result of the projection, containing detected changes and updated state
 */
interface CommentDetectionResult {
  changes: ChangeEvent[]                    // New comment change events to emit
  updatedCommentIds: Map<string, Set<string>>  // Updated mrId -> noteIds to merge into state
}

/**
 * Type guard for events that contain MR discussions
 */
function isRelevantEvent(event: LazyReviewerEvent): event is MrDiscussionsEvent {
  return event.type === 'gitlab-user-mrs-fetched-event' ||
         event.type === 'gitlab-project-mrs-fetched-event' ||
         event.type === 'gitlab-single-mr-fetched-event'
}

/**
 * Extract ALL MRs with flattened notes from an event using existing projection functions
 */
function extractMrsWithNotes(
  event: MrDiscussionsEvent
): MrDiscussionsByMrId {
  let gitlabMrs: GitlabMergeRequest[] = []

  if (event.type === 'gitlab-user-mrs-fetched-event') {
    gitlabMrs = projectGitlabUserMrsFetchedEvent(event)
  } else if (event.type === 'gitlab-project-mrs-fetched-event') {
    gitlabMrs = projectGitlabProjectMrsFetchedEvent(event)
  } else if (event.type === 'gitlab-single-mr-fetched-event') {
    const mr = projectGitlabSingleMrFetchedEvent(event)
    gitlabMrs = mr ? [mr] : []
  }

  const result = new Map<string, Set<string>>()

  for (const mr of gitlabMrs) {
    const noteIds = new Set(mr.discussions.flatMap(d => d.notes).map(n => n.id))
    result.set(mr.id, noteIds)
  }

  return result
}

/**
 * Pure diff function: takes two Sets, returns elements in current not in previous
 */
function diffNoteIds(
  previous: Set<string>,
  current: Set<string>
): Set<string> {
  return new Set([...current].filter(id => !previous.has(id)))
}

/**
 * Compute diff for a single MR - takes two Sets of the same type, returns only what's new
 */
function computeMrDiff(
  currentNoteIds: Set<string>,
  previousNoteIds: Set<string> | undefined,
  mrId: string
): MrCommentDiff {
  const previous = previousNoteIds ?? new Set<string>()
  const newIds = diffNoteIds(previous, currentNoteIds)

  return {
    mrId,
    newNoteIds: newIds
  }
}

/**
 * Convert diff to change events - just IDs
 */
function diffToChangeEvents(
  diff: MrCommentDiff
): ChangeEvent[] {
  return [...diff.newNoteIds].map(noteId => ({
    changeType: 'new-mr-comment' as const,
    mrId: diff.mrId,
    noteId: noteId
  }))
}

/**
 * Main projection: detect new comments on ALL MRs
 */
export function detectNewMrComments(
  state: ChangeTrackingState,
  event: LazyReviewerEvent
): CommentDetectionResult {
  // Early return if not relevant event
  if (!isRelevantEvent(event)) {
    return { changes: [], updatedCommentIds: new Map() }
  }

  const mrDiscussionsByMrId = extractMrsWithNotes(event)

  const changes: ChangeEvent[] = []
  const updatedCommentIds = new Map<string, Set<string>>()

  for (const [mrId, currentCommentIds] of mrDiscussionsByMrId) {
    const previousCommentIds = state.mrCommentIds.get(mrId)
    const diff = computeMrDiff(currentCommentIds, previousCommentIds, mrId)

    // Only emit changes if there are new notes
    if (diff.newNoteIds.size > 0) {
      const newChanges = diffToChangeEvents(diff)
      changes.push(...newChanges)
    }

    // Always update state with current note IDs
    updatedCommentIds.set(mrId, currentCommentIds)
  }

  return { changes, updatedCommentIds }
}
