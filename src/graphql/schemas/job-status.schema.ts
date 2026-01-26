import { Schema } from "effect"
import type { JobStatusQuery } from "../job-status.generated"

export const JobStatusQuerySchema: Schema.Schema<JobStatusQuery> = Schema.Struct({
  jobs: Schema.NullOr(Schema.Struct({
    nodes: Schema.NullOr(Schema.Array(
      Schema.NullOr(Schema.Struct({
      name: Schema.NullOr(Schema.String)
    }))
    ))
  }))
})
