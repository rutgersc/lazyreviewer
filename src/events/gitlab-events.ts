import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import type { MrPipelineQuery } from "../graphql/mr-pipeline.generated";
import type { MRsQuery } from "../graphql/mrs.generated";
import type { ProjectMRsQuery } from "../graphql/project-mrs.generated";
import type { SingleMrQuery } from "../graphql/single-mr.generated";
import type { ProjectPipelinesJobHistoryQuery } from "../graphql/project-pipelines-job-history.generated";

export type Event =
    | GitlabUserMergeRequestsFetchedEvent
    | GitlabprojectMergeRequestsFetchedEvent
    | GitlabSingleMrFetchedEvent
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

export interface GitlabSingleMrFetchedEvent {
    type: 'gitlab-single-mr-fetched-event',
    mr: SingleMrQuery,
    forProjectPath: string,
    forIid: string
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