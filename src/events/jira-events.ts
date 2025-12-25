import { Schema } from "effect"
import { JiraIssueSchema, JiraSearchResponseSchema } from "../jira/jira-schema";
import { EventIdSchema } from "./event-id";

// Jira event schemas
const JiraIssuesFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('jira-issues-fetched-event'),
  // searchResponse: JiraSearchResponseSchema,
  issues: JiraSearchResponseSchema,
  forTicketKeys: Schema.Array(Schema.String),
  timestamp: Schema.String
})

export type JiraIssuesFetchedEvent = Schema.Schema.Type<typeof JiraIssuesFetchedEventSchema>

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
  issues: Schema.mutable(Schema.Array(JiraIssueSchema)),
  timestamp: Schema.String
})

export type JiraSprintIssuesFetchedEvent = Schema.Schema.Type<typeof JiraSprintIssuesFetchedEventSchema>

export const JiraEventSchema = Schema.Union(
  JiraIssuesFetchedEventSchema,
  JiraSprintIssuesFetchedEventSchema
)

export type JiraEvent = JiraIssuesFetchedEvent | JiraSprintIssuesFetchedEvent

