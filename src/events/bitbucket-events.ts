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
