import type { LazyReviewerEvent } from "./events"
import type { CompactedEvent } from "./event-compaction-events"
import {
  projectToCompactedMergeRequestsState,
  isCompactedMergeRequestsEvent,
  type CompactedMergeRequestEntry,
  type CompactedMergeRequestsState
} from "../mergerequests/mergerequest-compaction-projection"
import {
  projectToCompactedJiraIssuesState,
  isCompactedJiraIssuesEvent,
  type CompactedJiraIssueEntry,
  type CompactedJiraIssuesState
} from "../jira/jira-compaction-projection"
import { generateEventId } from "./event-id"

export interface CompactedState {
  mergeRequests: CompactedMergeRequestsState
  jiraIssues: CompactedJiraIssuesState
}

export const projectToCompactedState = (
  state: CompactedState,
  event: LazyReviewerEvent
): CompactedState => {
  let newMrState = state.mergeRequests
  let newJiraState = state.jiraIssues

  if (isCompactedMergeRequestsEvent(event)) {
    newMrState = projectToCompactedMergeRequestsState(state.mergeRequests, event)
  }

  if (isCompactedJiraIssuesEvent(event)) {
    newJiraState = projectToCompactedJiraIssuesState(state.jiraIssues, event)
  }

  return {
    mergeRequests: newMrState,
    jiraIssues: newJiraState
  }
}

export const initialCompactedState: CompactedState = {
  mergeRequests: new Map<string, CompactedMergeRequestEntry>(),
  jiraIssues: new Map<string, CompactedJiraIssueEntry>()
}

export const projectEventsToCompactedState = (events: LazyReviewerEvent[]): CompactedState => {
  return events.reduce(projectToCompactedState, initialCompactedState)
}

export const compactedStateToEvent = (state: CompactedState): CompactedEvent => {
  const mrs = Array.from(state.mergeRequests.values()).map(entry => entry.mr)
  const jiraIssues = Array.from(state.jiraIssues.values()).map(entry => entry.issue)

  const timestamp = new Date().toISOString()
  const type = 'compacted-event' as const

  return {
    eventId: generateEventId(timestamp, type),
    type,
    mrs,
    jiraIssues,
    timestamp
  }
}
