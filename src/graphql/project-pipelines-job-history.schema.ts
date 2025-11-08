import * as Types from './generated/gitlab-base-types';

import { Schema } from "effect"
import type { ProjectPipelinesJobHistoryQuery } from "./project-pipelines-job-history.generated"
import { PipelineStatusEnumSchema, CiJobStatusSchema } from "./generated/gitlab-base-types.schema"

export const ProjectPipelinesJobHistoryQuerySchema: Schema.Schema<ProjectPipelinesJobHistoryQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    pipelines: Schema.NullOr(Schema.Struct({
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(Schema.Struct({
        id: Schema.Any,
        iid: Schema.String,
        ref: Schema.NullOr(Schema.String),
        createdAt: Schema.String,
        status: PipelineStatusEnumSchema,
        source: Schema.NullOr(Schema.String),
        mergeRequest: Schema.NullOr(Schema.Struct({
          iid: Schema.String,
          title: Schema.String,
          author: Schema.NullOr(Schema.Struct({
            username: Schema.String
          }))
        })),
        job: Schema.NullOr(Schema.Struct({
          id: Schema.NullOr(Schema.Unknown),
          webPath: Schema.NullOr(Schema.String),
          name: Schema.NullOr(Schema.String),
          status: Schema.NullOr(CiJobStatusSchema),
          failureMessage: Schema.NullOr(Schema.String),
          startedAt: Schema.NullOr(Schema.String),
          duration: Schema.NullOr(Schema.Number)
        }))
      }))
      ))
    }))
  }))
})
