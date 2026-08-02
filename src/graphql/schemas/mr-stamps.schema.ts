import { Schema } from "effect"
import type { MergeRequestStampFieldsFragment, MrStampsQuery } from "../mr-stamps.generated"
import { MergeRequestStateSchema, DetailedMergeStatusSchema, CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const MergeRequestStampFieldsFragmentSchema: Schema.Codec<MergeRequestStampFieldsFragment> = Schema.Struct({
  id: Schema.Any,
  iid: Schema.String,
  updatedAt: Schema.String,
  state: MergeRequestStateSchema,
  detailedMergeStatus: Schema.NullOr(DetailedMergeStatusSchema),
  diffHeadSha: Schema.NullOr(Schema.String),
  approvedBy: Schema.NullOr(Schema.Struct({
    nodes: Schema.NullOr(Schema.Array(
      Schema.NullOr(Schema.Struct({
      id: Schema.Unknown
    }))
    ))
  })),
  headPipeline: Schema.NullOr(Schema.Struct({
    iid: Schema.String,
    jobs: Schema.NullOr(Schema.Struct({
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(Schema.Struct({
        name: Schema.NullOr(Schema.String),
        status: Schema.NullOr(CiJobStatusSchema),
        retried: Schema.NullOr(Schema.Boolean)
      }))
      ))
    }))
  }))
})

export const MrStampsQuerySchema: Schema.Codec<MrStampsQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    mergeRequests: Schema.NullOr(Schema.Struct({
      pageInfo: Schema.Struct({
        hasNextPage: Schema.Boolean,
        endCursor: Schema.NullOr(Schema.String)
      }),
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(MergeRequestStampFieldsFragmentSchema)
      ))
    }))
  }))
})
