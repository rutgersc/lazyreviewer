import { Schema } from "effect"

export type ChangeType = 'new-mr-comment'

const NewMrCommentChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-mr-comment'),
  mrId: Schema.String,
  noteId: Schema.String,
  seenAt: Schema.NullOr(Schema.Date)
})

export const ChangeEventSchema = NewMrCommentChangeSchema
export type ChangeEvent = Schema.Schema.Type<typeof ChangeEventSchema>
