import * as Types from '../generated/gitlab-base-types';

import { Schema } from "effect"
import type { SingleMrQuery } from "../single-mr.generated"
import { MergeRequestFieldsFragmentSchema } from "./mrs.schema"

export const SingleMrQuerySchema: Schema.Schema<SingleMrQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.Any,
    mergeRequest: Schema.NullOr(MergeRequestFieldsFragmentSchema)
  }))
})
