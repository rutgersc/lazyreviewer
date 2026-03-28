import { Schema } from "effect";

export const CiJobStatusSchema = Schema.Literals([
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
])
export type CiJobStatus = Schema.Schema.Type<typeof CiJobStatusSchema>
