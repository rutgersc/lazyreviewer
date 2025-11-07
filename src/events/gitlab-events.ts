import type { MergeRequestState, MrPipelineQuery, MRsQuery, ProjectMRsQuery, ProjectPipelinesJobHistoryQuery } from "../generated/gitlab-sdk";

export type Event =
    | GitlabUserMergeRequestsFetchedEvent
    | GitlabprojectMergeRequestsFetchedEvent
    | GitlabJobTraceFetchedEvent
    | GitlabPipelineFetchedEvent
    | GitlabJobHistoryFetchedEvent

export interface GitlabUserMergeRequestsFetchedEvent {
    type: 'gitlab-user-mrs-fetched-event',
    mrs: MRsQuery,
    forUsernames: string[],
    forState: MergeRequestState
}

export interface GitlabprojectMergeRequestsFetchedEvent {
    type: 'gitlab-project-mrs-fetched-event',
    mrs: ProjectMRsQuery,
    forProjectPath: string,
    forState: MergeRequestState
}

export interface GitlabJobTraceFetchedEvent {
    type: 'gitlab-jobtrace-fetched-event',
    jobTrace: string,
    forProjectId: string,
    forJobId: string
}

export interface GitlabPipelineFetchedEvent {
    type: 'gitlab-pipeline-fetched-event',
    pipeline: MrPipelineQuery,
    forProjectPath: string,
    forIid: string
}

export interface GitlabJobHistoryFetchedEvent {
    type: 'gitlab-jobhistory-fetched-event',
    jobHistory: ProjectPipelinesJobHistoryQuery, // JobHistoryEntry[]
    forProjectPath: string,
    forJobName: string
}