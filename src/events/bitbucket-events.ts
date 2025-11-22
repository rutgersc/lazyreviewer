import { Schema } from "effect"
import { BitbucketPullRequestsResponseSchema, BitbucketPullRequestSchema, BitbucketCommentsResponseSchema } from "../bitbucket/bitbucket-schema";

// Bitbucket event schemas
const BitbucketPrsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-prs-fetched-event'),
  prsResponse: BitbucketPullRequestsResponseSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forState: Schema.Union(
    Schema.Literal('opened'),
    Schema.Literal('merged'),
    Schema.Literal('closed'),
    Schema.Literal('all'),
    Schema.Literal('locked')
  )
})

export type BitbucketPrsFetchedEvent = Schema.Schema.Type<typeof BitbucketPrsFetchedEventSchema>

const BitbucketSinglePrFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-single-pr-fetched-event'),
  pr: BitbucketPullRequestSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

export type BitbucketSinglePrFetchedEvent = Schema.Schema.Type<typeof BitbucketSinglePrFetchedEventSchema>

const BitbucketPrCommentsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-pr-comments-fetched-event'),
  commentsResponse: BitbucketCommentsResponseSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

export type BitbucketPrCommentsFetchedEvent = Schema.Schema.Type<typeof BitbucketPrCommentsFetchedEventSchema>

export const BitbucketEventSchema = Schema.Union(
  BitbucketPrsFetchedEventSchema,
  BitbucketSinglePrFetchedEventSchema,
  BitbucketPrCommentsFetchedEventSchema
)

export type BitbucketEvent = Schema.Schema.Type<typeof BitbucketEventSchema>
