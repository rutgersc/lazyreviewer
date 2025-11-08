import * as Types from './generated/gitlab-base-types';

import { Schema } from "effect"
import type { ProjectQuery } from "./project.generated"

export const ProjectQuerySchema: Schema.Schema<ProjectQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    mergeRequests: Schema.NullOr(Schema.Struct({
      nodes: Schema.NullOr(Schema.Array(
        Schema.NullOr(Schema.Struct({
        webPath: Schema.String,
        name: Schema.NullOr(Schema.String)
      }))
      ))
    }))
  }))
})
