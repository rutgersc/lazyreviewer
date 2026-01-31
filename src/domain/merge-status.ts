import { Schema } from "effect";

export const DetailedMergeStatusSchema = Schema.Literal(
  'APPROVALS_SYNCING',
  'BLOCKED_STATUS',
  'CHECKING',
  'CI_MUST_PASS',
  'CI_STILL_RUNNING',
  'COMMITS_STATUS',
  'CONFLICT',
  'DISCUSSIONS_NOT_RESOLVED',
  'DRAFT_STATUS',
  'EXTERNAL_STATUS_CHECKS',
  'JIRA_ASSOCIATION',
  'LOCKED_LFS_FILES',
  'LOCKED_PATHS',
  'MERGEABLE',
  'MERGE_TIME',
  'NEED_REBASE',
  'NOT_APPROVED',
  'NOT_OPEN',
  'PREPARING',
  'SECURITY_POLICIES_VIOLATIONS',
  'TITLE_NOT_MATCHING',
  'UNCHECKED'
)
export type DetailedMergeStatus = Schema.Schema.Type<typeof DetailedMergeStatusSchema>
