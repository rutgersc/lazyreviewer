import { Schema } from "effect"
import { MergeRequestStateSchema, CiJobStatusSchema } from "../graphql/generated/gitlab-base-types.schema"

export const GitlabRawMergeRequestSchema = Schema.Struct({
  id: Schema.String,
  iid: Schema.String,
  name: Schema.NullOr(Schema.String),
  webUrl: Schema.NullOr(Schema.String),
  sourceBranch: Schema.String,
  targetBranch: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  state: MergeRequestStateSchema,
  project: Schema.Struct({
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.String
  }),
  author: Schema.NullOr(Schema.Struct({
    name: Schema.String,
    avatarUrl: Schema.NullOr(Schema.String)
  })),
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
              createdAt: Schema.String,
              resolvable: Schema.Boolean,
              resolved: Schema.Boolean,
              author: Schema.NullOr(Schema.Struct({
                name: Schema.String
              })),
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
          id: Schema.String,
          name: Schema.NullOr(Schema.String),
          status: Schema.NullOr(Schema.String),
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
          }))
        }))
      ))
    }))
  }))
})

export type GitlabRawMergeRequest = Schema.Schema.Type<typeof GitlabRawMergeRequestSchema>
