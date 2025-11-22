import { Schema } from "effect"
import { GitlabRawMergeRequestSchema, type GitlabRawMergeRequest } from "../gitlab/gitlab-raw-schema";
import { BitbucketPullRequestSchema } from "../bitbucket/bitbucket-schema";
import type { BitbucketPullRequest } from "../bitbucket/bitbucketapi";

const MergeRequestsCompactedEventSchema = Schema.Struct({
  type: Schema.Literal('mergerequests-compacted-event'),
  mrs: Schema.Array(Schema.Union(GitlabRawMergeRequestSchema, BitbucketPullRequestSchema))
})

export interface MergeRequestsCompactedEvent extends Schema.Schema.Type<typeof MergeRequestsCompactedEventSchema> {}

export const CompactionEventSchema = Schema.Union(
  MergeRequestsCompactedEventSchema
)
