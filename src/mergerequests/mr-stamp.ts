import type { MergeRequestStampFieldsFragment } from "../graphql/mr-stamps.generated"
import type { MergeRequest } from "./mergerequest-schema"

export type MrStamp = string

// The two constructors below must stay byte-identical for an unchanged MR: if they drift, either
// every MR looks changed forever or none ever does. That is why they live in one file — and why
// the sweep side repeats mapMrFragment's coalescing of nullable job name/status verbatim.
const compose = (parts: readonly (string | number | null)[]): MrStamp =>
  parts.map(part => part === null ? '~' : String(part)).join('|')

const jobSignature = (jobs: readonly string[]): string => [...jobs].sort().join(',')

export const stampOfMergeRequest = (mr: MergeRequest): MrStamp =>
  compose([
    mr.updatedAt.toISOString(),
    mr.state,
    mr.detailedMergeStatus,
    mr.diffHeadSha,
    mr.approvedBy.length,
    mr.pipeline.iid,
    jobSignature(mr.pipeline.stage.flatMap(stage => stage.jobs).map(job => `${job.name}=${job.status}`)),
  ])

export const stampOfNode = (node: MergeRequestStampFieldsFragment): MrStamp =>
  compose([
    new Date(node.updatedAt).toISOString(),
    node.state,
    node.detailedMergeStatus,
    node.diffHeadSha,
    node.approvedBy?.nodes?.length ?? 0,
    node.headPipeline?.iid ?? null,
    jobSignature(
      (node.headPipeline?.jobs?.nodes ?? [])
        // Pipeline.jobs is flat and includes superseded attempts; the stage-grouped jobs the held
        // side is built from only carry the current one. Without this every retried job is a
        // permanent phantom difference.
        .filter((job): job is NonNullable<typeof job> => job !== null && job.retried !== true)
        .map(job => `${job.name || ''}=${job.status || 'CREATED'}`)
    ),
  ])
