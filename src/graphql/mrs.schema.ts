import { Schema } from "effect"
import type { MRsQuery } from "./mrs.generated"
import { MergeRequestStateSchema, CiJobStatusSchema } from "./generated/gitlab-base-types.schema"

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
            Schema.NullOr(Schema.Struct({
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
                    id: Schema.Any, // GraphQL ID scalar
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
                    id: Schema.Any, // GraphQL ID scalar
                    notes: Schema.Struct({
                      nodes: Schema.NullOr(Schema.Array(
                        Schema.NullOr(Schema.Struct({
                          __typename: Schema.Literal('Note'),
                          id: Schema.Any, // GraphQL ID scalar
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
                            id: Schema.NullOr(Schema.Any), // GraphQL ID scalar
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
            }))
          ))
        }))
      }))
    ))
  }))
})
