import { Schema } from "effect"
import type { JiraSearchResponse } from "../jira/jira-schema";

export type JiraEvent =
    | JiraIssuesFetchedEvent

export interface JiraIssuesFetchedEvent {
    type: 'jira-issues-fetched-event',
    searchResponse: JiraSearchResponse,
    issues: JiraSearchResponse,
    forTicketKeys: string[]
}

// Jira event schemas
const JiraIssuesFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('jira-issues-fetched-event'),
  searchResponse: Schema.Unknown,
  issues: Schema.Unknown,
  forTicketKeys: Schema.Array(Schema.String)
})

export const JiraEventSchema = Schema.Union(
  JiraIssuesFetchedEventSchema
)
