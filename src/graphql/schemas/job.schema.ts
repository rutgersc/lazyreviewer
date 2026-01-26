import { Schema } from "effect"
import type { JobTraceQuery } from "../job.generated"
import { CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const JobTraceQuerySchema: Schema.Schema<JobTraceQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    job: Schema.NullOr(Schema.Struct({
      id: Schema.NullOr(Schema.Unknown),
      name: Schema.NullOr(Schema.String),
      status: Schema.NullOr(CiJobStatusSchema),
      failureMessage: Schema.NullOr(Schema.String),
      trace: Schema.NullOr(Schema.Struct({
        __typename: Schema.Literal('CiJobTrace'),
        htmlSummary: Schema.String
      }))
    }))
  }))
})
