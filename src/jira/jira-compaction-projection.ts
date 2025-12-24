import type { JiraIssue } from "./jira-schema"
import { defineProjection } from "../utils/define-projection"

export interface CompactedJiraIssueEntry {
  issue: JiraIssue
}

export type CompactedJiraIssuesState = Map<string, CompactedJiraIssueEntry>

export const projectToCompactedJiraIssuesState = defineProjection({
  initialState: new Map<string, CompactedJiraIssueEntry> satisfies CompactedJiraIssuesState,
  handlers: {
    'compacted-event': (state, event) => {
      const newState = new Map<string, CompactedJiraIssueEntry>()
      event.jiraIssues.forEach(issue => {
        newState.set(
          issue.key,
          {
            issue,
          })
      })
      return newState
    },
    'jira-issues-fetched-event': (state, event) => {
      const newState = new Map(state)
      event.issues.issues.forEach(issue => {
        newState.set(issue.key, {
          issue,
        })
      })
      return newState
    },
    'jira-sprint-issues-fetched-event': (state, event) => {
      const newState = new Map(state)
      event.issues.forEach(issue => {
        newState.set(
          issue.key,
          {
            issue,
          })
      })
      return newState
    }
  }
})

