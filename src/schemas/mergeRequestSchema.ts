// import * as Schema from "@effect/schema/Schema"
import { KeyValueStore } from "@effect/platform";
import { Effect , Schema} from "effect";

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
  startedAt: Schema.String
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
  id: Schema.String,
  iid: Schema.String,
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
  state: Schema.String,
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

const JiraCommentContentTextSchema = Schema.Struct({
  text: Schema.optional(Schema.String),
  type: Schema.String
})

const JiraCommentContentBlockSchema = Schema.Struct({
  content: Schema.mutable(Schema.Array(JiraCommentContentTextSchema)),
  type: Schema.String
})

const JiraCommentBodySchema = Schema.Struct({
  content: Schema.mutable(Schema.Array(JiraCommentContentBlockSchema)),
  type: Schema.String
})

const JiraCommentSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.Struct({
    displayName: Schema.String,
    emailAddress: Schema.String
  }),
  body: JiraCommentBodySchema,
  created: Schema.String,
  updated: Schema.String
})

export const JiraIssueSchema = Schema.Struct({
  key: Schema.String,
  id: Schema.String,
  self: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    parent: Schema.optional(Schema.Struct({
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        issuetype: Schema.Struct({
          name: Schema.String
        })
      })
    })),
    status: Schema.Struct({
      name: Schema.String,
      statusCategory: Schema.Struct({
        name: Schema.String
      })
    }),
    assignee: Schema.optional(Schema.NullOr(Schema.Struct({
      displayName: Schema.String,
      emailAddress: Schema.String
    }))),
    priority: Schema.Struct({
      name: Schema.String
    }),
    issuetype: Schema.Struct({
      name: Schema.String
    }),
    created: Schema.String,
    updated: Schema.String,
    comment: Schema.Struct({
      total: Schema.Number,
      comments: Schema.mutable(Schema.Array(JiraCommentSchema))
    })
  })
}).annotations({ identifier: "JiraIssue" })

export const MergeRequestSchema = Schema.Struct({
  ...GitlabMergeRequestSchema.fields,
  jiraIssues: Schema.mutable(Schema.Array(JiraIssueSchema))
}).annotations({ identifier: "MergeRequest" })

export interface MergeRequest extends Schema.Schema.Type<typeof MergeRequestSchema> {}

export type PipelineJob = Schema.Schema.Type<typeof PipelineJobSchema>
export type PipelineStage = Schema.Schema.Type<typeof PipelineStageSchema>
export type DiscussionNote = Schema.Schema.Type<typeof DiscussionNoteSchema>
export type Discussion = Schema.Schema.Type<typeof DiscussionSchema>
export type GitlabMergeRequest = Schema.Schema.Type<typeof GitlabMergeRequestSchema>
export type JiraIssue = Schema.Schema.Type<typeof JiraIssueSchema>
