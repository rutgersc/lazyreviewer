import { Schema } from "effect"
import type { MergeRequestFieldsFragment, MRsQuery } from "../mrs.generated"
import { DetailedMergeStatusSchema, MergeRequestStateSchema, CiJobStatusSchema } from "../generated/gitlab-base-types.schema"

export const MergeRequestFieldsFragmentSchema: Schema.Schema<MergeRequestFieldsFragment> = Schema.Struct({
  id: Schema.Any,
  iid: Schema.String,
  name: Schema.NullOr(Schema.String),
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  webUrl: Schema.NullOr(Schema.String),
  sourceBranch: Schema.String,
  targetBranch: Schema.String,
  detailedMergeStatus: Schema.NullOr(DetailedMergeStatusSchema),
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
          system: Schema.Boolean,
          body: Schema.String,
          author: Schema.NullOr(Schema.Struct({
            name: Schema.String,
            username: Schema.String
          })),
          url: Schema.NullOr(Schema.String),
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
})

export const MRsQuerySchema: Schema.Schema<MRsQuery> = Schema.Struct({
  users: Schema.NullOr(Schema.Struct({
    count: Schema.Number,
    nodes: Schema.NullOr(Schema.Array(
      Schema.NullOr(Schema.Struct({
      username: Schema.String,
      authoredMergeRequests: Schema.NullOr(Schema.Struct({
        count: Schema.Number,
        pageInfo: Schema.Struct({
          hasNextPage: Schema.Boolean
        }),
        nodes: Schema.NullOr(Schema.Array(
          Schema.NullOr(MergeRequestFieldsFragmentSchema)
        ))
      }))
    }))
    ))
  }))
})
