import type { BitbucketPullRequestsResponse, BitbucketCommentsResponse } from "../bitbucket/bitbucketapi";

export type BitbucketEvent =
    | BitbucketPrsFetchedEvent
    | BitbucketPrCommentsFetchedEvent

export interface BitbucketPrsFetchedEvent {
    type: 'bitbucket-prs-fetched-event',
    prsResponse: BitbucketPullRequestsResponse,
    forWorkspace: string,
    forRepoSlug: string,
    forState: 'opened' | 'merged' | 'closed' | 'all' | 'locked'
}

export interface BitbucketPrCommentsFetchedEvent {
    type: 'bitbucket-pr-comments-fetched-event',
    commentsResponse: BitbucketCommentsResponse,
    forWorkspace: string,
    forRepoSlug: string,
    forPrId: number
}
