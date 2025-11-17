import { Schema } from "effect"
import type { BitbucketPullRequestsResponse, BitbucketCommentsResponse, BitbucketPullRequest } from "../bitbucket/bitbucketapi";

export type BitbucketEvent =
    | BitbucketPrsFetchedEvent
    | BitbucketSinglePrFetchedEvent
    | BitbucketPrCommentsFetchedEvent

export interface BitbucketPrsFetchedEvent {
    type: 'bitbucket-prs-fetched-event',
    prsResponse: BitbucketPullRequestsResponse,
    forWorkspace: string,
    forRepoSlug: string,
    forState: 'opened' | 'merged' | 'closed' | 'all' | 'locked'
}

export interface BitbucketSinglePrFetchedEvent {
    type: 'bitbucket-single-pr-fetched-event',
    pr: BitbucketPullRequest,
    forWorkspace: string,
    forRepoSlug: string,
    forPrId: number
}

export interface BitbucketPrCommentsFetchedEvent {
    type: 'bitbucket-pr-comments-fetched-event',
    commentsResponse: BitbucketCommentsResponse,
    forWorkspace: string,
    forRepoSlug: string,
    forPrId: number
}

// Bitbucket event schemas
const BitbucketPrsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-prs-fetched-event'),
  prsResponse: Schema.Unknown,
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

const BitbucketSinglePrFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-single-pr-fetched-event'),
  pr: Schema.Unknown,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

const BitbucketPrCommentsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-pr-comments-fetched-event'),
  commentsResponse: Schema.Unknown,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

export const BitbucketEventSchema = Schema.Union(
  BitbucketPrsFetchedEventSchema,
  BitbucketSinglePrFetchedEventSchema,
  BitbucketPrCommentsFetchedEventSchema
)
