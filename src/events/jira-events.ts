import { Schema } from "effect"
import type { JiraSearchResponse } from "../jira/jira-schema";

// Jira event schemas
const JiraIssuesFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('jira-issues-fetched-event'),
  searchResponse: Schema.Unknown,
  issues: Schema.Unknown,
  forTicketKeys: Schema.Array(Schema.String),
  timestamp: Schema.String
})

export interface JiraIssuesFetchedEvent extends Schema.Schema.Type<typeof JiraIssuesFetchedEventSchema> {
  searchResponse: JiraSearchResponse
  issues: JiraSearchResponse
}

export const JiraEventSchema = Schema.Union(
  JiraIssuesFetchedEventSchema
)

export type JiraEvent = Schema.Schema.Type<typeof JiraEventSchema>

