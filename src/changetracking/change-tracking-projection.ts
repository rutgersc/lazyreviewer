import type { LazyReviewerEvent } from '../events/events'
import type { JiraChange, JiraChangeTrackingRelevantEvent } from './jira-change-tracking'
import {
  isJiraChangeTrackingRelevantEvent,
  projectJiraChangeTracking,
  type JiraProjectionResult,
  type JiraStateForDelta
} from './jira-change-tracking'
import type {
  MrChange,
  MrChangeTrackingRelevantEvent,
  NewMrChange,
  MergedMrChange,
  ClosedMrChange,
  ReopenedMrChange,
  SystemNoteChange,
  DiffCommentChange,
  DiscussionCommentChange
} from './mr-change-tracking'
import {
  isMrChangeTrackingRelevantEvent,
  projectMrChangeTracking,
  type MrProjectionResult,
  type MrStateForDelta
} from './mr-change-tracking'

export type ChangeTrackingRelevantEvent = MrChangeTrackingRelevantEvent | JiraChangeTrackingRelevantEvent

export function isChangeTrackingRelevantEvent(event: LazyReviewerEvent): event is ChangeTrackingRelevantEvent {
  return isMrChangeTrackingRelevantEvent(event) || isJiraChangeTrackingRelevantEvent(event)
}

export type Change = MrChange | JiraChange

export {
  // MR exports
  isMrChangeTrackingRelevantEvent,
  projectMrChangeTracking,
  type MrChangeTrackingRelevantEvent,
  type MrProjectionResult,
  type MrStateForDelta,
  type MrChange,
  type NewMrChange,
  type MergedMrChange,
  type ClosedMrChange,
  type ReopenedMrChange,
  type SystemNoteChange,
  type DiffCommentChange,
  type DiscussionCommentChange,
  // Jira exports
  isJiraChangeTrackingRelevantEvent,
  projectJiraChangeTracking,
  type JiraChangeTrackingRelevantEvent,
  type JiraProjectionResult,
  type JiraStateForDelta,
  type JiraChange
}
