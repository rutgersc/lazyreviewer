import type { JiraComment, JiraIssue } from '../jira/jira-schema'
import type { AuthorIdentity } from '../userselection/userSelection'
import { defineProjection } from '../utils/define-projection'

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
  author: AuthorIdentity
  authorDisplayName: string
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

  const statusChanged = previousIssue.status !== latestIssue.status
  return {
    issueKey,
    commentsDelta: latestIssue.commentIds.difference(previousIssue.commentIds),
    ...(statusChanged && { statusDelta: { from: previousIssue.status, to: latestIssue.status } }),
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
        ...(delta.statusDelta.from !== undefined && { fromStatus: delta.statusDelta.from }),
        toStatus: delta.statusDelta.to,
        changedAt: new Date(issue.fields.updated)
      })
    }

    if (delta.commentsDelta.size > 0) {
      delta.commentsDelta.forEach((commentId) => {
        const comment = findJiraCommentById(issue, commentId)
        const jiraAuthor: AuthorIdentity = { provider: 'jira', accountId: comment?.author.accountId ?? 'unknown' }
        jiraDeltas.push({
          type: 'jira-comment',
          issue: issueInfo,
          commentId,
          author: jiraAuthor,
          authorDisplayName: comment?.author.displayName ?? 'unknown',
          changedAt: comment ? new Date(comment.created) : new Date()
        })
      })
    }

    jiraStatesForDelta.set(issue.key, latestState)
  }

  return { jiraStatesForDelta, jiraDeltas }
}

const initialJiraChangeTrackingState: JiraProjectionResult = {
  jiraStatesForDelta: new Map(),
  jiraDeltas: []
};

export const jiraChangeTrackingProjection = defineProjection({
  initialState: initialJiraChangeTrackingState,
  handlers: {
    "jira-issues-fetched-event": (state, event) =>
      detectJiraIssueChanges(state.jiraStatesForDelta, event.issues.issues),

    "jira-sprint-issues-fetched-event": (state, event) =>
      detectJiraIssueChanges(state.jiraStatesForDelta, event.issues),
  }
});
