import type { LazyReviewerEvent } from '../events/events'
import type { JiraIssuesFetchedEvent } from '../events/jira-events'
import type { CompactedEvent } from '../events/event-compaction-events'
import type { JiraComment, JiraIssue } from '../jira/jira-schema'

export type JiraChangeTrackingRelevantEvent = JiraIssuesFetchedEvent | CompactedEvent

export function isJiraChangeTrackingRelevantEvent(event: LazyReviewerEvent): event is JiraChangeTrackingRelevantEvent {
  return event.type === 'jira-issues-fetched-event' ||
         event.type === 'compacted-event'
}

export interface JiraStateForDelta {
  status: string
  commentIds: Set<string>
}

interface JiraDelta {
  issueKey: string
  commentsDelta: Set<string>
  statusDelta?: { from?: string; to: string }
}

interface JiraInfo {
  issueKey: string
  summary: string
}

export interface NewJiraIssueChange {
  type: 'new-jira-issue'
  issue: JiraInfo
  changedAt: Date
}

export interface JiraStatusChangedChange {
  type: 'jira-status-changed'
  issue: JiraInfo
  fromStatus?: string
  toStatus: string
  changedAt: Date
}

export interface JiraCommentChange {
  type: 'jira-comment'
  issue: JiraInfo
  commentId: string
  author: string
  changedAt: Date
}

export type JiraChange = NewJiraIssueChange | JiraStatusChangedChange | JiraCommentChange

export interface JiraProjectionResult {
  jiraStatesForDelta: Map<string, JiraStateForDelta>
  jiraDeltas: JiraChange[]
}

const getJiraCumulativeState = (issue: JiraIssue): JiraStateForDelta => ({
  status: issue.fields.status.name,
  commentIds: new Set(issue.fields.comment.comments.map((c) => c.id))
})

const calcJiraDelta = (
  issueKey: string,
  previousIssue: JiraStateForDelta | undefined,
  latestIssue: JiraStateForDelta
): JiraDelta => {
  if (!previousIssue) {
    return {
      issueKey,
      commentsDelta: new Set(),
      statusDelta: { to: latestIssue.status },
    }
  }

  return {
    issueKey,
    commentsDelta: latestIssue.commentIds.difference(previousIssue.commentIds),
    statusDelta: previousIssue.status !== latestIssue.status
      ? { from: previousIssue.status, to: latestIssue.status }
      : undefined,
  }
}

const findJiraCommentById = (issue: JiraIssue, commentId: string): JiraComment | undefined => {
  return issue.fields.comment.comments.find((c) => c.id === commentId)
}

const detectJiraIssueChanges = (
  jiraStatesForDelta: Map<string, JiraStateForDelta>,
  latestIssues: ReadonlyArray<JiraIssue>
): JiraProjectionResult => {
  // Create a copy of the input map to avoid mutating it
  jiraStatesForDelta = new Map(jiraStatesForDelta);
  const jiraDeltas: JiraChange[] = []

  for (const issue of latestIssues) {
    const previousState = jiraStatesForDelta.get(issue.key)
    const latestState = getJiraCumulativeState(issue)
    const delta = calcJiraDelta(issue.key, previousState, latestState)

    const issueInfo: JiraInfo = { issueKey: issue.key, summary: issue.fields.summary }

    if (delta.statusDelta && delta.statusDelta.from === undefined) {
      jiraDeltas.push({ type: 'new-jira-issue', issue: issueInfo, changedAt: new Date(issue.fields.created) })
    } else if (delta.statusDelta) {
      jiraDeltas.push({
        type: 'jira-status-changed',
        issue: issueInfo,
        fromStatus: delta.statusDelta.from,
        toStatus: delta.statusDelta.to,
        changedAt: new Date(issue.fields.updated)
      })
    }

    if (delta.commentsDelta.size > 0) {
      delta.commentsDelta.forEach((commentId) => {
        const comment = findJiraCommentById(issue, commentId)
        jiraDeltas.push({
          type: 'jira-comment',
          issue: issueInfo,
          commentId,
          author: comment?.author.displayName ?? 'unknown',
          changedAt: comment ? new Date(comment.created) : new Date()
        })
      })
    }

    jiraStatesForDelta.set(issue.key, latestState)
  }

  return { jiraStatesForDelta, jiraDeltas }
}

const projectCompactedEventJiraIssues = (event: CompactedEvent): ReadonlyArray<JiraIssue> => {
  return event.jiraIssues
}

export function projectJiraChangeTracking(
  jiraStatesForDelta: Map<string, JiraStateForDelta>,
  event: JiraChangeTrackingRelevantEvent
): JiraProjectionResult {
  if (event.type === 'jira-issues-fetched-event') {
    return detectJiraIssueChanges(jiraStatesForDelta, event.issues.issues)
  }
  if (event.type === 'compacted-event') {
    return detectJiraIssueChanges(jiraStatesForDelta, projectCompactedEventJiraIssues(event))
  }

  throw new Error('non-exhaustive match')
}
