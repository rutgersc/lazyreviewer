// import { Effect, Stream } from "effect"
// import type { GitlabRawMergeRequest } from "../gitlab/gitlab-raw-schema"
// import type { BitbucketPullRequest } from "../bitbucket/bitbucketapi"
// import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
// import type { LazyReviewerEvent } from "../events/events"
// import type { MergeRequestsCompactedEvent } from "../events/event-compaction-events"
// import { EventStorage } from "./eventStorage"
// import type {
//   GitlabUserMergeRequestsFetchedEvent,
//   GitlabprojectMergeRequestsFetchedEvent,
//   GitlabSingleMrFetchedEvent
// } from "../events/gitlab-events"
// import type {
//   BitbucketPrsFetchedEvent,
//   BitbucketSinglePrFetchedEvent
// } from "../events/bitbucket-events"

// export type CompactedMergeRequestsDependentEvents =
//   | GitlabUserMergeRequestsFetchedEvent
//   | GitlabprojectMergeRequestsFetchedEvent
//   | GitlabSingleMrFetchedEvent
//   | BitbucketPrsFetchedEvent
//   | BitbucketSinglePrFetchedEvent

// export interface CompactedMergeRequestEntry {
//   mr: GitlabRawMergeRequest | BitbucketPullRequest
//   forUsernames: string[]
//   forState: MergeRequestState | 'opened' | 'merged' | 'closed' | 'all' | 'locked' // Update to include Bitbucket states
//   forProjectPath: string
//   forIid: string | number
// }

// export type CompactedMergeRequestsState = Map<string, CompactedMergeRequestEntry>

// const getMrKey = (projectPath: string, mrId: string | number): string =>
//   `${projectPath}::${mrId}`

// type ProjectMrNode = NonNullable<
//   NonNullable<
//     NonNullable<GitlabprojectMergeRequestsFetchedEvent['mrs']['project']>['mergeRequests']
//   >['nodes']
// >[number]

// const mapProjectMrToRaw = (node: ProjectMrNode): GitlabRawMergeRequest => {
//   if (!node) throw new Error("Project MR node is null")
//   const { title, ...rest } = node
//   return {
//     ...rest,
//     name: title, // Map title to name
//   } satisfies GitlabRawMergeRequest
// }

// type SingleMrNode = NonNullable<
//   NonNullable<GitlabSingleMrFetchedEvent['mr']['project']>['mergeRequest']
// >

// const mapSingleMrToRaw = (node: SingleMrNode): GitlabRawMergeRequest => {
//   const { title, ...rest } = node
//   return {
//     ...rest,
//     name: title, // Map title to name
//   } satisfies GitlabRawMergeRequest
// }
