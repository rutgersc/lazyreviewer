import { Schema } from "effect"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import type { MrPipelineQuery } from "../graphql/mr-pipeline.generated";
import type { MRsQuery } from "../graphql/mrs.generated";
import type { ProjectMRsQuery } from "../graphql/project-mrs.generated";
import type { SingleMrQuery } from "../graphql/single-mr.generated";
import type { ProjectPipelinesJobHistoryQuery } from "../graphql/project-pipelines-job-history.generated";
import { MRsQuerySchema } from "../graphql/schemas/mrs.schema";

export type GitlabEvent =
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

// GitLab event schemas
const GitlabUserMergeRequestsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-user-mrs-fetched-event'),
  mrs: MRsQuerySchema,
  forUsernames: Schema.Array(Schema.String),
  forState: Schema.String
})

const GitlabProjectMergeRequestsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-project-mrs-fetched-event'),
  mrs: Schema.Unknown,
  forProjectPath: Schema.String,
  forState: Schema.String
})

const GitlabSingleMrFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-single-mr-fetched-event'),
  mr: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String
})

const GitlabJobTraceFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-jobtrace-fetched-event'),
  jobTrace: Schema.String,
  forProjectId: Schema.String,
  forJobId: Schema.String
})

const GitlabPipelineFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-pipeline-fetched-event'),
  pipeline: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String
})

const GitlabJobHistoryFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-jobhistory-fetched-event'),
  jobHistory: Schema.Unknown,
  forProjectPath: Schema.String,
  forJobName: Schema.String
})

export const GitlabEventSchema = Schema.Union(
  GitlabUserMergeRequestsFetchedEventSchema,
  GitlabProjectMergeRequestsFetchedEventSchema,
  GitlabSingleMrFetchedEventSchema,
  GitlabJobTraceFetchedEventSchema,
  GitlabPipelineFetchedEventSchema,
  GitlabJobHistoryFetchedEventSchema
)