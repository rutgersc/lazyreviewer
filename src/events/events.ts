import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "./gitlab-events";
import type { JiraIssuesFetchedEvent } from "./jira-events";
import type { BitbucketPrsFetchedEvent, BitbucketSinglePrFetchedEvent, BitbucketPrCommentsFetchedEvent } from "./bitbucket-events";

export type Event =
    | GitlabUserMergeRequestsFetchedEvent
    | GitlabprojectMergeRequestsFetchedEvent
    | GitlabSingleMrFetchedEvent
    | GitlabJobTraceFetchedEvent
    | GitlabPipelineFetchedEvent
    | GitlabJobHistoryFetchedEvent
    | JiraIssuesFetchedEvent
    | BitbucketPrsFetchedEvent
    | BitbucketSinglePrFetchedEvent
    | BitbucketPrCommentsFetchedEvent
