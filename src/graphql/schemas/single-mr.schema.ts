import { Schema } from "effect"
import type { SingleMrQuery } from "../single-mr.generated"
import { MergeRequestFieldsFragmentSchema } from "./mrs.schema"

export const SingleMrQuerySchema: Schema.Codec<SingleMrQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.Any,
    mergeRequest: Schema.NullOr(MergeRequestFieldsFragmentSchema)
  }))
})
