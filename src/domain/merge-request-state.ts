import { Schema } from "effect";

export const MergeRequestStateSchema = Schema.Literal('all', 'closed', 'locked', 'merged', 'opened')
export type MergeRequestState = Schema.Schema.Type<typeof MergeRequestStateSchema>
