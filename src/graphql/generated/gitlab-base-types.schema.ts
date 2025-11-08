import { Schema } from "effect"
import type { MergeRequestState, CiJobStatus } from "./gitlab-base-types"

// Schema for MergeRequestState enum
export const MergeRequestStateSchema: Schema.Schema<MergeRequestState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('locked'),
  Schema.Literal('merged'),
  Schema.Literal('opened')
)

// Schema for CiJobStatus enum
export const CiJobStatusSchema: Schema.Schema<CiJobStatus> = Schema.Union(
  Schema.Literal('CANCELED'),
  Schema.Literal('CANCELING'),
  Schema.Literal('CREATED'),
  Schema.Literal('FAILED'),
  Schema.Literal('MANUAL'),
  Schema.Literal('PENDING'),
  Schema.Literal('PREPARING'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SCHEDULED'),
  Schema.Literal('SKIPPED'),
  Schema.Literal('SUCCESS'),
  Schema.Literal('WAITING_FOR_CALLBACK'),
  Schema.Literal('WAITING_FOR_RESOURCE')
)
