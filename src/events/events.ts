import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "./gitlab-events";

type Event =
    | GitlabUserMergeRequestsFetchedEvent
    | GitlabprojectMergeRequestsFetchedEvent
    | GitlabJobTraceFetchedEvent
    | GitlabPipelineFetchedEvent
    | GitlabJobHistoryFetchedEvent
