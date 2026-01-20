import * as Types from '../generated/gitlab-base-types';

import { Schema } from "effect"
import type { PipelineFieldFragment } from "../mr-pipeline.generated"
import { CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const PipelineFieldFragmentSchema: Schema.Schema<PipelineFieldFragment> = Schema.Struct({
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
          active: Schema.Boolean
        }))
        ))
      })),
      status: Schema.NullOr(Schema.String)
    }))
    ))
  }))
})

import type { GetJobStatusQuery } from "../mr-pipeline.generated"
import { CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const GetJobStatusQuerySchema: Schema.Schema<GetJobStatusQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    job: Schema.NullOr(Schema.Struct({
      status: Schema.NullOr(CiJobStatusSchema),
      finishedAt: Schema.NullOr(Schema.String)
    }))
  }))
})

import type { MrPipelineQuery } from "../mr-pipeline.generated"
import { MergeRequestStateSchema } from "../generated/gitlab-base-types.schema"
import { PipelineFieldFragmentSchema } from "./mrs.schema"

export const MrPipelineQuerySchema: Schema.Schema<MrPipelineQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    mergeRequest: Schema.NullOr(Schema.Struct({
      id: Schema.Any,
      iid: Schema.String,
      state: MergeRequestStateSchema,
      headPipeline: Schema.NullOr(PipelineFieldFragmentSchema)
    }))
  }))
})

import type { MrPipelinesQuery } from "../mr-pipeline.generated"
import { PipelineFieldFragmentSchema } from "./mrs.schema"

export const MrPipelinesQuerySchema: Schema.Schema<MrPipelinesQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    mergeRequests: Schema.NullOr(Schema.Struct({
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(Schema.Struct({
        id: Schema.Any,
        iid: Schema.String,
        headPipeline: Schema.NullOr(PipelineFieldFragmentSchema)
      }))
      ))
    }))
  }))
})
