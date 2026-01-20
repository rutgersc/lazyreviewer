import { Schema, Brand } from "effect";
import type { CiJobStatus } from "../graphql/generated/gitlab-base-types";
import { MergeRequestStateSchema } from "../graphql/generated/gitlab-base-types.schema";

// Branded types for type-safe MR identifiers (zero runtime overhead)
export type MrGid = string & Brand.Brand<"MrGid">
export type MrIid = string & Brand.Brand<"MrIid">

export const MrGid = Brand.nominal<MrGid>()
export const MrIid = Brand.nominal<MrIid>()

export const PipelineJobSchema = Schema.Struct({
  id: Schema.String,
  localId: Schema.Number,
  name: Schema.String,
  status: Schema.Literal(
    'CANCELED',
    'CANCELING',
    'CREATED',
    'FAILED',
    'MANUAL',
    'PENDING',
    'PREPARING',
    'RUNNING',
    'SCHEDULED',
    'SKIPPED',
    'SUCCESS',
    'WAITING_FOR_CALLBACK',
    'WAITING_FOR_RESOURCE'
  ),
  failureMessage: Schema.NullOr(Schema.String),
  webPath: Schema.NullOr(Schema.String),
  startedAt: Schema.String,
  duration: Schema.NullOr(Schema.Number)
}); //.annotations({ identifier: "PipelineJob" })

export const PipelineStageSchema = Schema.Struct({
  name: Schema.String,
  jobs: Schema.mutable(Schema.Array(PipelineJobSchema))
}).annotations({ identifier: "PipelineStage" })

export const DiscussionNoteSchema = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  author: Schema.String,
  createdAt: Schema.Date,
  resolvable: Schema.Boolean,
  resolved: Schema.Boolean,
  system: Schema.Boolean,
  url: Schema.String,
  position: Schema.NullOr(Schema.Struct({
    filePath: Schema.NullOr(Schema.String),
    newLine: Schema.NullOr(Schema.Number),
    oldLine: Schema.NullOr(Schema.Number),
    oldPath: Schema.NullOr(Schema.String)
  }))
}).annotations({ identifier: "DiscussionNote" })

export const DiscussionSchema = Schema.Struct({
  id: Schema.String,
  resolved: Schema.Boolean,
  resolvable: Schema.Boolean,
  notes: Schema.mutable(Schema.Array(DiscussionNoteSchema))
}).annotations({ identifier: "Discussion" })

export const GitlabMergeRequestSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.fromBrand(MrGid)),
  iid: Schema.String.pipe(Schema.fromBrand(MrIid)),
  title: Schema.String,
  jiraIssueKeys: Schema.mutable(Schema.Array(Schema.String)),
  webUrl: Schema.String,
  sourcebranch: Schema.String,
  targetbranch: Schema.String,
  project: Schema.Struct({
    name: Schema.String,
    path: Schema.String,
    fullPath: Schema.String
  }),
  author: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  state: MergeRequestStateSchema,
  approvedBy: Schema.mutable(Schema.Array(Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    username: Schema.String
  }))),
  resolvableDiscussions: Schema.Number,
  resolvedDiscussions: Schema.Number,
  unresolvedDiscussions: Schema.Number,
  totalDiscussions: Schema.Number,
  discussions: Schema.mutable(Schema.Array(DiscussionSchema)),
  pipeline: Schema.Struct({
    stage: Schema.mutable(Schema.Array(PipelineStageSchema))
  })
}).annotations({ identifier: "GitlabMergeRequest" })

export interface JobHistoryEntry {
  jobId: string;
  jobName: string;
  jobStatus: CiJobStatus;
  failureMessage: string | null;
  startedAt: string;
  duration: number | null;
  pipelineId: string;
  pipelineIid: number;
  pipelineRef: string;
  pipelineCreatedAt: string;
  pipelineSource: string;
  webPath: string | null;
  shortShaCommit: string | null;
  isDevelopBranch: boolean;
  mergeRequestIid: string | null;
  mergeRequestTitle: string | null;
  mergeRequestAuthor: string | null;
  runner: {
    description: string,
    shortSha: string
  } | null
}

export type PipelineJob = Schema.Schema.Type<typeof PipelineJobSchema>
export type PipelineStage = Schema.Schema.Type<typeof PipelineStageSchema>
export type DiscussionNote = Schema.Schema.Type<typeof DiscussionNoteSchema>
export type Discussion = Schema.Schema.Type<typeof DiscussionSchema>
export type GitlabMergeRequest = Schema.Schema.Type<typeof GitlabMergeRequestSchema>

// Discriminated union for note types based on their semantic meaning
export interface SystemNote {
  readonly type: 'system';
  readonly id: string;
  readonly body: string;
  readonly author: string;
  readonly createdAt: Date;
}

export interface DiscussionComment {
  readonly type: 'discussion';
  readonly id: string;
  readonly body: string;
  readonly author: string;
  readonly createdAt: Date;
  readonly resolved: boolean;
}

export interface DiffComment {
  readonly type: 'diff';
  readonly id: string;
  readonly body: string;
  readonly author: string;
  readonly createdAt: Date;
  readonly resolved: boolean;
  readonly filePath: string;
  readonly newLine: number | null;
  readonly oldLine: number | null;
}

export type NoteType = SystemNote | DiscussionComment | DiffComment;