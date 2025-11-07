import type { JiraSearchResponse } from "../jira/jira-schema";

export type JiraEvent =
    | JiraIssuesFetchedEvent

export interface JiraIssuesFetchedEvent {
    type: 'jira-issues-fetched-event',
    searchResponse: JiraSearchResponse,
    issues: JiraSearchResponse,
    forTicketKeys: string[]
}
