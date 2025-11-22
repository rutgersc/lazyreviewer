import * as Types from '../generated/gitlab-base-types';

import { Schema } from "effect"
import type { ProjectsQuery } from "../projects.generated"

export const ProjectsQuerySchema: Schema.Schema<ProjectsQuery> = Schema.Struct({
  projects: Schema.NullOr(Schema.Struct({
    count: Schema.Number,
    nodes: Schema.NullOr(Schema.Array(
      Schema.NullOr(Schema.Struct({
      id: Schema.Any,
      name: Schema.String,
      fullPath: Schema.Any,
      mergeRequests: Schema.NullOr(Schema.Struct({
        nodes: Schema.NullOr(Schema.Array(
          Schema.NullOr(Schema.Struct({
          name: Schema.NullOr(Schema.String),
          webPath: Schema.String
        }))
        ))
      }))
    }))
    ))
  }))
})
