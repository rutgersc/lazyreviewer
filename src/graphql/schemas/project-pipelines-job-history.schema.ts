import { Schema } from "effect"
import type { ProjectPipelinesJobHistoryQuery } from "../project-pipelines-job-history.generated"
import { PipelineStatusEnumSchema, CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const ProjectPipelinesJobHistoryQuerySchema: Schema.Codec<ProjectPipelinesJobHistoryQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    pipelines: Schema.NullOr(Schema.Struct({
      pageInfo: Schema.Struct({
        hasNextPage: Schema.Boolean,
        endCursor: Schema.NullOr(Schema.String)
      }),
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
          sourceBranch: Schema.String,
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
          shortSha: Schema.String,
          duration: Schema.NullOr(Schema.Number),
          commitPath: Schema.NullOr(Schema.String),
          runner: Schema.NullOr(Schema.Struct({
            id: Schema.Unknown,
            description: Schema.NullOr(Schema.String),
            shortSha: Schema.NullOr(Schema.String)
          }))
        }))
      }))
      ))
    }))
  }))
})
