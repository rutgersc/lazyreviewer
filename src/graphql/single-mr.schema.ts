import * as Types from './generated/gitlab-base-types';

import { Schema } from "effect"
import type { SingleMrQuery } from "./single-mr.generated"
import { MergeRequestStateSchema, CiJobStatusSchema } from "./generated/gitlab-base-types.schema"

export const SingleMrQuerySchema: Schema.Schema<SingleMrQuery> = Schema.Struct({
  project: Schema.NullOr(Schema.Struct({
    id: Schema.Any,
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.Any,
    mergeRequest: Schema.NullOr(Schema.Struct({
      id: Schema.Any,
      iid: Schema.String,
      title: Schema.String,
      webUrl: Schema.NullOr(Schema.String),
      sourceBranch: Schema.String,
      targetBranch: Schema.String,
      project: Schema.Struct({
        name: Schema.String,
        path: Schema.String,
        fullPath: Schema.Any
      }),
      author: Schema.NullOr(Schema.Struct({
        name: Schema.String,
        username: Schema.String,
        avatarUrl: Schema.NullOr(Schema.String)
      })),
      createdAt: Schema.String,
      updatedAt: Schema.String,
      state: MergeRequestStateSchema,
      approvedBy: Schema.NullOr(Schema.Struct({
        nodes: Schema.NullOr(Schema.Array(
          Schema.NullOr(Schema.Struct({
          id: Schema.Unknown,
          name: Schema.String,
          username: Schema.String
        }))
        ))
      })),
      discussions: Schema.Struct({
        nodes: Schema.NullOr(Schema.Array(
          Schema.NullOr(Schema.Struct({
          resolved: Schema.Boolean,
          resolvable: Schema.Boolean,
          id: Schema.Unknown,
          notes: Schema.Struct({
            nodes: Schema.NullOr(Schema.Array(
              Schema.NullOr(Schema.Struct({
              id: Schema.Unknown,
              __typename: Schema.Literal('Note'),
              body: Schema.String,
              author: Schema.NullOr(Schema.Struct({
                name: Schema.String
              })),
              createdAt: Schema.String,
              resolvable: Schema.Boolean,
              resolved: Schema.Boolean,
              position: Schema.NullOr(Schema.Struct({
                filePath: Schema.String,
                newLine: Schema.NullOr(Schema.Number),
                oldLine: Schema.NullOr(Schema.Number),
                oldPath: Schema.NullOr(Schema.String)
              }))
            }))
            ))
          })
        }))
        ))
      }),
      headPipeline: Schema.NullOr(Schema.Struct({
        active: Schema.Boolean,
        iid: Schema.String,
        stages: Schema.NullOr(Schema.Struct({
          __typename: Schema.Literal('CiStageConnection'),
          nodes: Schema.NullOr(Schema.Array(
            Schema.NullOr(Schema.Struct({
            id: Schema.Any,
            name: Schema.NullOr(Schema.String),
            jobs: Schema.NullOr(Schema.Struct({
              nodes: Schema.NullOr(Schema.Array(
                Schema.NullOr(Schema.Struct({
                id: Schema.NullOr(Schema.Unknown),
                webPath: Schema.NullOr(Schema.String),
                name: Schema.NullOr(Schema.String),
                status: Schema.NullOr(CiJobStatusSchema),
                failureMessage: Schema.NullOr(Schema.String),
                startedAt: Schema.NullOr(Schema.String),
                duration: Schema.NullOr(Schema.Number)
              }))
              ))
            })),
            status: Schema.NullOr(Schema.String)
          }))
          ))
        }))
      }))
    }))
  }))
})
