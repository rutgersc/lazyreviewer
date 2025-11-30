import { Schema } from "effect"

export type ChangeType =
  | 'new-mr'
  | 'new-comment-on-my-mr'
  | 'new-reply-to-my-comment'
  | 'jira-status-change'

const NewMrChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-mr'),
  mrId: Schema.String,
  mrIid: Schema.String,
  mrTitle: Schema.String,
  author: Schema.String,
  projectPath: Schema.String,
  detectedAt: Schema.Date
})

const NewCommentOnMyMrChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-comment-on-my-mr'),
  mrId: Schema.String,
  mrIid: Schema.String,
  mrTitle: Schema.String,
  discussionId: Schema.String,
  noteId: Schema.String,
  commentAuthor: Schema.String,
  commentBody: Schema.String,
  detectedAt: Schema.Date
})

const NewReplyToMyCommentChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-reply-to-my-comment'),
  mrId: Schema.String,
  mrIid: Schema.String,
  mrTitle: Schema.String,
  discussionId: Schema.String,
  originalNoteId: Schema.String,
  replyNoteId: Schema.String,
  replyAuthor: Schema.String,
  replyBody: Schema.String,
  detectedAt: Schema.Date
})

const JiraStatusChangeSchema = Schema.Struct({
  changeType: Schema.Literal('jira-status-change'),
  jiraKey: Schema.String,
  oldStatus: Schema.String,
  newStatus: Schema.String,
  summary: Schema.String,
  detectedAt: Schema.Date
})

export const ChangeEventSchema = Schema.Union(
  NewMrChangeSchema,
  NewCommentOnMyMrChangeSchema,
  NewReplyToMyCommentChangeSchema,
  JiraStatusChangeSchema
)

export type NewMrChange = Schema.Schema.Type<typeof NewMrChangeSchema>
export type NewCommentOnMyMrChange = Schema.Schema.Type<typeof NewCommentOnMyMrChangeSchema>
export type NewReplyToMyCommentChange = Schema.Schema.Type<typeof NewReplyToMyCommentChangeSchema>
export type JiraStatusChange = Schema.Schema.Type<typeof JiraStatusChangeSchema>
export type ChangeEvent = Schema.Schema.Type<typeof ChangeEventSchema>
