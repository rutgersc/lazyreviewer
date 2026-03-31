import { Schema, SchemaGetter } from "effect"
import { JiraIssueSchema, JiraSearchResponseSchema } from "../jira/jira-schema";
import { JiraSprintSchema } from "../jiraboard/schema";
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

const NumberOrStringAsNumber = Schema.Union([Schema.Number, Schema.String]).pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((input) => typeof input === 'string' ? Number(input) : input),
    encode: SchemaGetter.transform((n) => n)
  })
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

const JiraSprintsLoadedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('jira-sprints-loaded-event'),
  boardId: Schema.Number,
  sprints: Schema.mutable(Schema.Array(JiraSprintSchema)),
  timestamp: Schema.String
})

export type JiraSprintsLoadedEvent = Schema.Schema.Type<typeof JiraSprintsLoadedEventSchema>

export const JiraEventSchema = Schema.Union([
  JiraIssuesFetchedEventSchema,
  JiraSprintIssuesFetchedEventSchema,
  JiraSprintsLoadedEventSchema
])

export type JiraEvent = JiraIssuesFetchedEvent | JiraSprintIssuesFetchedEvent | JiraSprintsLoadedEvent

