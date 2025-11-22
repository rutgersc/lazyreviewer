import { Schema } from "effect"
import type { BitbucketPullRequest } from "./bitbucketapi"

export const BitbucketAccountSchema = Schema.Struct({
  display_name: Schema.String,
  uuid: Schema.String,
  account_id: Schema.optional(Schema.String),
  nickname: Schema.optional(Schema.String),
})

export const BitbucketBranchSchema = Schema.Struct({
  name: Schema.String,
})

export const BitbucketCommitSchema = Schema.Struct({
  hash: Schema.String,
})

export const BitbucketRepositorySchema = Schema.Struct({
  name: Schema.String,
  full_name: Schema.String,
})

export const BitbucketSourceSchema = Schema.Struct({
  branch: BitbucketBranchSchema,
  commit: BitbucketCommitSchema,
  repository: BitbucketRepositorySchema,
})

export const BitbucketDestinationSchema = Schema.Struct({
  branch: BitbucketBranchSchema,
  commit: BitbucketCommitSchema,
  repository: BitbucketRepositorySchema,
})

export const BitbucketParticipantSchema = Schema.Struct({
  user: BitbucketAccountSchema,
  role: Schema.String,
  approved: Schema.Boolean,
  participated_on: Schema.optional(Schema.String),
})

export const BitbucketPullRequestSchema: Schema.Schema<BitbucketPullRequest> = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  state: Schema.Union(
    Schema.Literal("OPEN"),
    Schema.Literal("MERGED"),
    Schema.Literal("DECLINED"),
    Schema.Literal("SUPERSEDED")
  ),
  author: BitbucketAccountSchema,
  source: BitbucketSourceSchema,
  destination: BitbucketDestinationSchema,
  participants: Schema.optional(Schema.Array(BitbucketParticipantSchema)),
  reviewers: Schema.optional(Schema.Array(BitbucketAccountSchema)),
  created_on: Schema.String,
  updated_on: Schema.String,
  comment_count: Schema.optional(Schema.Number),
  task_count: Schema.optional(Schema.Number),
  links: Schema.Struct({
    html: Schema.Struct({
      href: Schema.String,
    }),
    self: Schema.Struct({
      href: Schema.String,
    }),
  }),
})

export const BitbucketPullRequestsResponseSchema = Schema.Struct({
  values: Schema.Array(BitbucketPullRequestSchema),
  page: Schema.optional(Schema.Number),
  pagelen: Schema.optional(Schema.Number),
  size: Schema.optional(Schema.Number),
  next: Schema.optional(Schema.String),
})

export const BitbucketCommentResolutionSchema = Schema.Struct({
  type: Schema.String,
  user: BitbucketAccountSchema,
  created_on: Schema.String,
})

export const BitbucketCommentSchema = Schema.Struct({
  id: Schema.Number,
  created_on: Schema.String,
  updated_on: Schema.String,
  content: Schema.Struct({
    raw: Schema.String,
    markup: Schema.optional(Schema.String),
    html: Schema.optional(Schema.String),
  }),
  user: BitbucketAccountSchema,
  deleted: Schema.optional(Schema.Boolean),
  parent: Schema.optional(Schema.Struct({
    id: Schema.Number,
  })),
  inline: Schema.optional(Schema.Struct({
    from: Schema.optional(Schema.Number),
    to: Schema.optional(Schema.Number),
    path: Schema.String,
  })),
  links: Schema.Struct({
    self: Schema.Struct({
      href: Schema.String,
    }),
    html: Schema.Struct({
      href: Schema.String,
    }),
  }),
  pullrequest: Schema.optional(Schema.Struct({
    type: Schema.String,
    id: Schema.Number,
  })),
  resolution: Schema.optional(Schema.NullOr(BitbucketCommentResolutionSchema)),
})

export const BitbucketCommentsResponseSchema = Schema.Struct({
  values: Schema.Array(BitbucketCommentSchema),
  page: Schema.optional(Schema.Number),
  pagelen: Schema.optional(Schema.Number),
  size: Schema.optional(Schema.Number),
  next: Schema.optional(Schema.String),
})
