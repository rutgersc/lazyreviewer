import { Schema } from "effect"
import type { GitlabMRsQuery } from "../gitlab-mrs.generated"
import { MergeRequestFieldsFragmentSchema } from "./mrs.schema"

export const GitlabMRsQuerySchema: Schema.Codec<GitlabMRsQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.Any,
    mergeRequests: Schema.NullOr(Schema.Struct({
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(MergeRequestFieldsFragmentSchema)
      )),
      pageInfo: Schema.Struct({
        hasNextPage: Schema.Boolean
      })
    }))
  }))
})
