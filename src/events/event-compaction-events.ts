import { Schema } from "effect"
import { BitbucketPullRequestSchema } from "../bitbucket/bitbucket-schema";
import { MergeRequestFieldsFragmentSchema } from "../graphql/schemas/mrs.schema";

const MergeRequestsCompactedEventSchema = Schema.Struct({
  type: Schema.Literal('mergerequests-compacted-event'),
  mrs: Schema.Array(Schema.Union(MergeRequestFieldsFragmentSchema, BitbucketPullRequestSchema))
})

export interface MergeRequestsCompactedEvent extends Schema.Schema.Type<typeof MergeRequestsCompactedEventSchema> {}

export const CompactionEventSchema = Schema.Union(
  MergeRequestsCompactedEventSchema
)
