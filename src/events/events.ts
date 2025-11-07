import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "./gitlab-events";
import type { JiraIssuesFetchedEvent } from "./jira-events";
import type { BitbucketPrsFetchedEvent, BitbucketPrCommentsFetchedEvent } from "./bitbucket-events";

export type Event =
    | GitlabUserMergeRequestsFetchedEvent
    | GitlabprojectMergeRequestsFetchedEvent
    | GitlabJobTraceFetchedEvent
    | GitlabPipelineFetchedEvent
    | GitlabJobHistoryFetchedEvent
    | JiraIssuesFetchedEvent
    | BitbucketPrsFetchedEvent
    | BitbucketPrCommentsFetchedEvent
