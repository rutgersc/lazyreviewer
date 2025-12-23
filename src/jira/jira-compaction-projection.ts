import type { CompactedEvent } from "../events/event-compaction-events"
import type { LazyReviewerEvent } from "../events/events"
import type { JiraIssue } from "./jira-schema"
import type { JiraIssuesFetchedEvent, JiraSprintIssuesFetchedEvent } from "../events/jira-events"

export type CompactedJiraIssuesDependentEvents = JiraIssuesFetchedEvent | JiraSprintIssuesFetchedEvent

export type CompactedJiraIssuesEvent =
  | CompactedJiraIssuesDependentEvents
  | CompactedEvent

export interface CompactedJiraIssueEntry {
  issue: JiraIssue
  forTicketKeys: string[]
}

export type CompactedJiraIssuesState = Map<string, CompactedJiraIssueEntry>

const getIssueKey = (issueKey: string): string => issueKey

export const isCompactedJiraIssuesEvent = (event: LazyReviewerEvent): event is CompactedJiraIssuesEvent =>
  event.type === 'jira-issues-fetched-event' ||
  event.type === 'compacted-event'

const projectIssuesToState = (issues: ReadonlyArray<JiraIssue>): CompactedJiraIssuesState => {
  const newState = new Map<string, CompactedJiraIssueEntry>()
  issues.forEach(issue => {
    const key = getIssueKey(issue.key)
    newState.set(key, {
      issue,
      forTicketKeys: [issue.key]
    })
  })
  return newState
}

export const projectToCompactedJiraIssuesState = (
  state: CompactedJiraIssuesState,
  event: CompactedJiraIssuesEvent
): CompactedJiraIssuesState => {
  switch (event.type) {
    case 'compacted-event': {
      return projectIssuesToState(event.jiraIssues)
    }

    case 'jira-issues-fetched-event': {
      const newState = new Map(state)
      const issues = event.issues.issues
      issues.forEach(issue => {
        const key = getIssueKey(issue.key)
        newState.set(key, {
          issue,
          forTicketKeys: [...event.forTicketKeys]
        })
      })
      return newState
    }

    case 'jira-sprint-issues-fetched-event':
      return state; // TODOR: fix still

    default:
      const _: never = event
      throw new Error("unexpected non-exhaustive match")
  }
}
