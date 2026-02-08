import { Schema } from "effect"
import type { ProjectMRsQuery } from "../project-mrs.generated"
import { MergeRequestFieldsFragmentSchema } from "./mrs.schema"

export const ProjectMRsQuerySchema: Schema.Schema<ProjectMRsQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.Any,
    mergeRequests: Schema.NullOr(Schema.Struct({
      count: Schema.Number,
      pageInfo: Schema.Struct({
        hasNextPage: Schema.Boolean,
        endCursor: Schema.NullOr(Schema.String)
      }),
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(MergeRequestFieldsFragmentSchema)
      ))
    }))
  }))
})
