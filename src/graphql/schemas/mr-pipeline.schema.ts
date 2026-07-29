import { Schema } from "effect"
import type { PipelineFieldFragment, MrPipelineQuery } from "../mr-pipeline.generated"
import { CiJobStatusSchema, MergeRequestStateSchema } from "../generated/gitlab-base-types.schema"

export const PipelineFieldFragmentSchema: Schema.Codec<PipelineFieldFragment> = Schema.Struct({
  active: Schema.Boolean,
  iid: Schema.String,
  stages: Schema.NullOr(Schema.Struct({
    __typename: Schema.Literal('CiStageConnection'),
    nodes: Schema.NullOr(Schema.Array(
      Schema.NullOr(Schema.Struct({
      id: Schema.Any,
      name: Schema.NullOr(Schema.String),
      jobs: Schema.NullOr(Schema.Struct({
        nodes: Schema.NullOr(Schema.Array(
          Schema.NullOr(Schema.Struct({
          id: Schema.NullOr(Schema.Unknown),
          webPath: Schema.NullOr(Schema.String),
          name: Schema.NullOr(Schema.String),
          status: Schema.NullOr(CiJobStatusSchema),
          failureMessage: Schema.NullOr(Schema.String),
          startedAt: Schema.NullOr(Schema.String),
          duration: Schema.NullOr(Schema.Number),
          finishedAt: Schema.NullOr(Schema.String),
          active: Schema.Boolean,
          allowFailure: Schema.Boolean
        }))
        ))
      })),
      status: Schema.NullOr(Schema.String)
    }))
    ))
  }))
})

export const MrPipelineQuerySchema: Schema.Codec<MrPipelineQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    mergeRequest: Schema.NullOr(Schema.Struct({
      id: Schema.Any,
      iid: Schema.String,
      state: MergeRequestStateSchema,
      headPipeline: Schema.NullOr(PipelineFieldFragmentSchema)
    }))
  }))
})
