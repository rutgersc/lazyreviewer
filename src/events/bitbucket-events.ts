import { Schema } from "effect"
import { BitbucketPullRequestsResponseSchema, BitbucketPullRequestSchema, BitbucketCommentsResponseSchema } from "../bitbucket/bitbucket-schema";
import { EventIdSchema } from "./event-id";

// Bitbucket event schemas
const BitbucketPrsFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('bitbucket-prs-fetched-event'),
  prsResponse: BitbucketPullRequestsResponseSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forState: Schema.Literals(['opened', 'merged', 'closed', 'all', 'locked']),
  timestamp: Schema.String
})

export type BitbucketPrsFetchedEvent = Schema.Schema.Type<typeof BitbucketPrsFetchedEventSchema>

const BitbucketSinglePrFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('bitbucket-single-pr-fetched-event'),
  pr: BitbucketPullRequestSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number,
  timestamp: Schema.String
})

export type BitbucketSinglePrFetchedEvent = Schema.Schema.Type<typeof BitbucketSinglePrFetchedEventSchema>

const BitbucketPrCommentsFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('bitbucket-pr-comments-fetched-event'),
  commentsResponse: BitbucketCommentsResponseSchema,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number,
  timestamp: Schema.String
})

export type BitbucketPrCommentsFetchedEvent = Schema.Schema.Type<typeof BitbucketPrCommentsFetchedEventSchema>

export const BitbucketEventSchema = Schema.Union([
  BitbucketPrsFetchedEventSchema,
  BitbucketSinglePrFetchedEventSchema,
  BitbucketPrCommentsFetchedEventSchema
])

export type BitbucketEvent = Schema.Schema.Type<typeof BitbucketEventSchema>
