import { Schema } from "effect"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import type { MergeRequest } from "../mergerequests/mergerequest-schema";
import { MergeRequestSchema } from "../mergerequests/mergerequest-schema";

export interface MergeRequestsCompactedEvent {
    type: 'mergerequests-compacted-event',
    mrs: MergeRequest[]
}

const MergeRequestsCompactedEventSchema = Schema.Struct({
  type: Schema.Literal('mergerequests-compacted-event'),
  mrs: Schema.Array(MergeRequestSchema)
})

export const CompactionEventSchema = Schema.Union(
  MergeRequestsCompactedEventSchema
)