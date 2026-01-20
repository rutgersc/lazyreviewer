import { Schema } from "effect"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { MergeRequestStateSchema } from "../graphql/generated/gitlab-base-types.schema";
import type { MrPipelineQuery } from "../graphql/mr-pipeline.generated";
import type { MRsQuery } from "../graphql/mrs.generated";
import type { ProjectMRsQuery } from "../graphql/project-mrs.generated";
import type { SingleMrQuery } from "../graphql/single-mr.generated";
import type { ProjectPipelinesJobHistoryQuery } from "../graphql/project-pipelines-job-history.generated";
import { MRsQuerySchema } from "../graphql/schemas/mrs.schema";
import { EventIdSchema } from "./event-id";
import { SingleMrQuerySchema } from "../graphql/schemas/single-mr.schema";
import { GitlabMRsQuerySchema } from "../graphql/schemas/gitlab-mrs.schema";

// GitLab event schemas
const GitlabUserMergeRequestsFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-user-mrs-fetched-event'),
  mrs: MRsQuerySchema,
  forUsernames: Schema.Array(Schema.String),
  forState: MergeRequestStateSchema,
  timestamp: Schema.String
})

export type GitlabUserMergeRequestsFetchedEvent = Schema.Schema.Type<typeof GitlabUserMergeRequestsFetchedEventSchema>

const GitlabProjectMergeRequestsFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-project-mrs-fetched-event'),
  mrs: Schema.Unknown,
  forProjectPath: Schema.String,
  forState: Schema.String,
  timestamp: Schema.String
})

export interface GitlabprojectMergeRequestsFetchedEvent extends Schema.Schema.Type<typeof GitlabProjectMergeRequestsFetchedEventSchema> {
  mrs: ProjectMRsQuery
  forState: MergeRequestState
}

const GitlabSingleMrFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-single-mr-fetched-event'),
  mr: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String,
  timestamp: Schema.String
})

export interface GitlabSingleMrFetchedEvent extends Schema.Schema.Type<typeof GitlabSingleMrFetchedEventSchema> {
  mr: SingleMrQuery
}

const GitlabMrsFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-mrs-fetched-event'),
  mrs: GitlabMRsQuerySchema,
  forProjectPath: Schema.String,
  forIids: Schema.Array(Schema.String),
  timestamp: Schema.String
})

export interface GitlabMrsFetchedEvent extends Schema.Schema.Type<typeof GitlabMrsFetchedEventSchema> { };

const GitlabJobTraceFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-jobtrace-fetched-event'),
  jobTrace: Schema.String,
  forProjectId: Schema.String,
  forJobId: Schema.String,
  timestamp: Schema.String
})

export type GitlabJobTraceFetchedEvent = Schema.Schema.Type<typeof GitlabJobTraceFetchedEventSchema>

const GitlabPipelineFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-pipeline-fetched-event'),
  pipeline: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String,
  timestamp: Schema.String
})

export interface GitlabPipelineFetchedEvent extends Schema.Schema.Type<typeof GitlabPipelineFetchedEventSchema> {
  pipeline: MrPipelineQuery
}

const GitlabJobHistoryFetchedEventSchema = Schema.Struct({
  eventId: EventIdSchema,
  type: Schema.Literal('gitlab-jobhistory-fetched-event'),
  jobHistory: Schema.Unknown,
  forProjectPath: Schema.String,
  forJobName: Schema.String,
  timestamp: Schema.String
})

export interface GitlabJobHistoryFetchedEvent extends Schema.Schema.Type<typeof GitlabJobHistoryFetchedEventSchema> {
  jobHistory: ProjectPipelinesJobHistoryQuery
}

export const GitlabEventSchema = Schema.Union(
  GitlabUserMergeRequestsFetchedEventSchema,
  GitlabProjectMergeRequestsFetchedEventSchema,
  GitlabSingleMrFetchedEventSchema,
  GitlabMrsFetchedEventSchema,
  GitlabJobTraceFetchedEventSchema,
  GitlabPipelineFetchedEventSchema,
  GitlabJobHistoryFetchedEventSchema
)

// Use manually refined interfaces (with proper types) instead of schema-inferred types
export type GitlabEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent
  | GitlabMrsFetchedEvent
  | GitlabJobTraceFetchedEvent
  | GitlabPipelineFetchedEvent
  | GitlabJobHistoryFetchedEvent
