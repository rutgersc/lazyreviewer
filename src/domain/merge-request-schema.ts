import { Schema } from "effect";
import type { CiJobStatus } from "./ci-status";
import { MrGid, MrIid } from "./identifiers";
import { MergeRequestStateSchema } from "./merge-request-state";
import { DetailedMergeStatusSchema } from "./merge-status";

export const PipelineJobSchema = Schema.Struct({
  id: Schema.String,
  localId: Schema.Number,
  name: Schema.String,
  status: Schema.Literals([
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
  ]),
  failureMessage: Schema.NullOr(Schema.String),
  webPath: Schema.NullOr(Schema.String),
  startedAt: Schema.String,
  duration: Schema.NullOr(Schema.Number)
})

export const PipelineStageSchema = Schema.Struct({
  name: Schema.String,
  jobs: Schema.mutable(Schema.Array(PipelineJobSchema))
}).pipe(Schema.annotate({ identifier: "PipelineStage" }))

export const DiscussionNoteSchema = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  author: Schema.String,
  authorUsername: Schema.String,
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
}).pipe(Schema.annotate({ identifier: "DiscussionNote" }))

export const DiscussionSchema = Schema.Struct({
  id: Schema.String,
  resolved: Schema.Boolean,
  resolvable: Schema.Boolean,
  notes: Schema.mutable(Schema.Array(DiscussionNoteSchema))
}).pipe(Schema.annotate({ identifier: "Discussion" }))

export const MergeRequestSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.fromBrand("MrGid", MrGid)),
  iid: Schema.String.pipe(Schema.fromBrand("MrIid", MrIid)),
  provider: Schema.Literals(['gitlab', 'bitbucket']),
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  jiraIssueKeys: Schema.mutable(Schema.Array(Schema.String)),
  webUrl: Schema.String,
  sourcebranch: Schema.String,
  targetbranch: Schema.String,
  diffHeadSha: Schema.NullOr(Schema.String),
  detailedMergeStatus: Schema.NullOr(DetailedMergeStatusSchema),
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
}).pipe(Schema.annotate({ identifier: "MergeRequest" }))

export interface JobHistoryEntry {
  readonly jobId: string;
  readonly jobName: string;
  readonly jobStatus: CiJobStatus;
  readonly failureMessage: string | null;
  readonly startedAt: string;
  readonly duration: number | null;
  readonly pipelineId: string;
  readonly pipelineIid: number;
  readonly pipelineRef: string;
  readonly pipelineCreatedAt: string;
  readonly pipelineSource: string;
  readonly webPath: string | null;
  readonly shortShaCommit: string | null;
  readonly isDevelopBranch: boolean;
  readonly mergeRequestIid: string | null;
  readonly mergeRequestTitle: string | null;
  readonly mergeRequestAuthor: string | null;
  readonly runner: {
    readonly description: string,
    readonly shortSha: string
  } | null
}

export type PipelineJob = Schema.Schema.Type<typeof PipelineJobSchema>
export type PipelineStage = Schema.Schema.Type<typeof PipelineStageSchema>
export type DiscussionNote = Schema.Schema.Type<typeof DiscussionNoteSchema>
export type Discussion = Schema.Schema.Type<typeof DiscussionSchema>
export type MergeRequest = Schema.Schema.Type<typeof MergeRequestSchema>

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
