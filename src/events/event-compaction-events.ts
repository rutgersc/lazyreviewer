import { Schema } from "effect"
import { BitbucketPullRequestSchema } from "../bitbucket/bitbucket-schema";
import { MergeRequestFieldsFragmentSchema } from "../graphql/schemas/mrs.schema";
import { JiraIssueSchema } from "../jira/jira-schema";
import { EventIdSchema } from "./event-id";

const CompactedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('compacted-event'),
  mrs: Schema.Array(Schema.Union(MergeRequestFieldsFragmentSchema, BitbucketPullRequestSchema)),
  jiraIssues: Schema.Array(JiraIssueSchema),
  timestamp: Schema.String
})

export interface CompactedEvent extends Schema.Schema.Type<typeof CompactedEventSchema> {}

export const CompactionEventSchemaUnion = CompactedEventSchema
