import {
  jiraChangeTrackingProjection,
  type JiraChange,
  type JiraProjectionResult,
  type JiraStateForDelta
} from './jira-change-tracking-projection'
import {
  mrChangeTrackingProjection,
  type MrChange,
  type MrInfo,
  type NewMrChange,
  type MergedMrChange,
  type ClosedMrChange,
  type ReopenedMrChange,
  type SystemNoteChange,
  type SystemNotesCompactedChange,
  type DiffCommentChange,
  type DiscussionCommentChange,
  type MrProjectionResult,
  type MrStateForDelta
} from './mr-change-tracking-projection'

export type Change = MrChange | JiraChange

export {
  // MR exports
  mrChangeTrackingProjection,
  type MrProjectionResult,
  type MrStateForDelta,
  type MrChange,
  type MrInfo,
  type NewMrChange,
  type MergedMrChange,
  type ClosedMrChange,
  type ReopenedMrChange,
  type SystemNoteChange,
  type SystemNotesCompactedChange,
  type DiffCommentChange,
  type DiscussionCommentChange,
  // Jira exports
  jiraChangeTrackingProjection,
  type JiraProjectionResult,
  type JiraStateForDelta,
  type JiraChange
}
