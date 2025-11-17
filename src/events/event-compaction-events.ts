import { Schema } from "effect"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import type { MergeRequest } from "../mergerequests/mergeRequestSchema";
import { MergeRequestSchema } from "../mergerequests/mergeRequestSchema";

export interface MergeRequestsCompactedEvent {
    type: 'mergerequests-compacted-event',
    mrs: MergeRequest,
    forUsernames: string[],
    forState: MergeRequestState
    forProjectPath: string,
    forMrid: string
}

const MergeRequestsCompactedEventSchema = Schema.Struct({
  type: Schema.Literal('mergerequests-compacted-event'),
  mrs: MergeRequestSchema,
  forUsernames: Schema.Array(Schema.String),
  forState: Schema.String,
  forProjectPath: Schema.String,
  forMrid: Schema.String
})

export const CompactionEventSchema = Schema.Union(
  MergeRequestsCompactedEventSchema
)