import { Schema } from "effect"
import type { JiraSearchResponse, JiraIssue } from "../jira/jira-schema";
import { EventIdSchema } from "./event-id";

// Jira event schemas
const JiraIssuesFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
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

const NumberOrStringAsNumber = Schema.transform(
  Schema.Union(Schema.Number, Schema.String),
  Schema.Number,
  {
    decode: (input) => typeof input === 'string' ? Number(input) : input,
    encode: (n) => n
  }
)

const JiraSprintIssuesFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('jira-sprint-issues-fetched-event'),
  sprintId: Schema.Number,
  boardId: NumberOrStringAsNumber,
  issues: Schema.Unknown,
  timestamp: Schema.String
})

export interface JiraSprintIssuesFetchedEvent extends Schema.Schema.Type<typeof JiraSprintIssuesFetchedEventSchema> {
  issues: JiraIssue[]
}

export const JiraEventSchema = Schema.Union(
  JiraIssuesFetchedEventSchema,
  JiraSprintIssuesFetchedEventSchema
)

// Use the manually refined interfaces (with proper types) instead of schema-inferred types
export type JiraEvent = JiraIssuesFetchedEvent | JiraSprintIssuesFetchedEvent

