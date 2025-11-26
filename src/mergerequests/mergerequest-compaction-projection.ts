import { Effect, Stream } from "effect"
import type { MergeRequestsCompactedEvent } from "../events/event-compaction-events"
import { EventStorage } from "../eventstore/eventStorage"
// import { type CompactedMergeRequestsDependentEvents, type CompactedMergeRequestEntry, type CompactedMergeRequestsState } from "../eventstore/mergeRequestProjection"
import type { LazyReviewerEvent } from "../events/events"
import type { GitlabRawMergeRequest } from "../gitlab/gitlab-raw-schema"
import type { BitbucketPullRequest } from "../bitbucket/bitbucketapi"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import type {
  GitlabUserMergeRequestsFetchedEvent,
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from "../events/gitlab-events"
import type {
  BitbucketPrsFetchedEvent,
  BitbucketSinglePrFetchedEvent
} from "../events/bitbucket-events"

export type CompactedMergeRequestsDependentEvents =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent
  | BitbucketPrsFetchedEvent
  | BitbucketSinglePrFetchedEvent

export interface CompactedMergeRequestEntry {
  mr: GitlabRawMergeRequest | BitbucketPullRequest
  forUsernames: string[]
  forState: MergeRequestState | 'opened' | 'merged' | 'closed' | 'all' | 'locked' // Update to include Bitbucket states
  forProjectPath: string
  forIid: string | number
}

export type CompactedMergeRequestsState = Map<string, CompactedMergeRequestEntry>

const getMrKey = (projectPath: string, mrId: string | number): string =>
  `${projectPath}::${mrId}`

type ProjectMrNode = NonNullable<
  NonNullable<
    NonNullable<GitlabprojectMergeRequestsFetchedEvent['mrs']['project']>['mergeRequests']
  >['nodes']
>[number]

const mapProjectMrToRaw = (node: ProjectMrNode): GitlabRawMergeRequest => {
  if (!node) throw new Error("Project MR node is null")
  const { title, ...rest } = node
  return {
    ...rest,
    name: title, // Map title to name
  } satisfies GitlabRawMergeRequest
}

type SingleMrNode = NonNullable<
  NonNullable<GitlabSingleMrFetchedEvent['mr']['project']>['mergeRequest']
>

const mapSingleMrToRaw = (node: SingleMrNode): GitlabRawMergeRequest => {
  const { title, ...rest } = node
  return {
    ...rest,
    name: title, // Map title to name
  } satisfies GitlabRawMergeRequest
}

const isCompactedMergeRequestsDependentEvent = (event: LazyReviewerEvent): event is CompactedMergeRequestsDependentEvents =>
  event.type === 'gitlab-user-mrs-fetched-event' ||
  event.type === 'gitlab-project-mrs-fetched-event' ||
  event.type === 'gitlab-single-mr-fetched-event' ||
  event.type === 'bitbucket-prs-fetched-event' ||
  event.type === 'bitbucket-single-pr-fetched-event'

const projectMergeRequests = (
  state: CompactedMergeRequestsState,
  event: CompactedMergeRequestsDependentEvents
): CompactedMergeRequestsState => {
  switch (event.type) {
    case 'gitlab-user-mrs-fetched-event': {
      const newState = new Map(state)
      const users = event.mrs.users?.nodes || []
      users.forEach(user => {
        if (!user) return
        const mrs = user.authoredMergeRequests?.nodes || []
        mrs.forEach(mr => {
          if (!mr) return
          const rawMr = mr // no mapping needed
          const key = getMrKey(rawMr.project.fullPath, rawMr.iid)
          newState.set(key, {
            mr: rawMr,
            forUsernames: [...event.forUsernames],
            forState: event.forState,
            forProjectPath: rawMr.project.fullPath,
            forIid: rawMr.iid
          })
        })
      })
      return newState
    }

    case 'gitlab-project-mrs-fetched-event': {
      const newState = new Map(state)
      const mrs = event.mrs.project?.mergeRequests?.nodes || []
      mrs.forEach(mr => {
        if (!mr) return
        const rawMr = mapProjectMrToRaw(mr)
        const key = getMrKey(rawMr.project.fullPath, rawMr.iid)
        newState.set(key, {
          mr: rawMr,
          forUsernames: [rawMr.author?.name || ''],
          forState: event.forState,
          forProjectPath: event.forProjectPath,
          forIid: rawMr.iid
        })
      })
      return newState
    }

    case 'gitlab-single-mr-fetched-event': {
      const newState = new Map(state)
      const mr = event.mr.project?.mergeRequest
      if (!mr) return newState

      const rawMr = mapSingleMrToRaw(mr)
      const key = getMrKey(rawMr.project.fullPath, rawMr.iid)
      newState.set(key, {
        mr: rawMr,
        forUsernames: [rawMr.author?.name || ''],
        forState: 'all', // Single fetch implies specific targeting
        forProjectPath: event.forProjectPath,
        forIid: event.forIid
      })
      return newState
    }

    case 'bitbucket-prs-fetched-event': {
      const newState = new Map(state)
      const prs = event.prsResponse.values
      prs.forEach(pr => {
        const repoFullName = pr.destination.repository.full_name
        const key = getMrKey(repoFullName, pr.id)
        newState.set(key, {
          mr: pr,
          forUsernames: [pr.author.display_name],
          forState: event.forState,
          forProjectPath: repoFullName,
          forIid: pr.id
        })
      })
      return newState
    }

    case 'bitbucket-single-pr-fetched-event': {
      const newState = new Map(state)
      const pr = event.pr
      const repoFullName = pr.destination.repository.full_name
      const key = getMrKey(repoFullName, pr.id)
      newState.set(key, {
        mr: pr,
        forUsernames: [pr.author.display_name],
        forState: 'all',
        forProjectPath: repoFullName,
        forIid: pr.id
      })
      return newState
    }

    default:
        const _: never = event;
        throw new Error("unexpected non-exhaustive match")
  }
}

export const compactedStateStream = Effect.gen(function* () {
  return (yield* EventStorage.eventsStream).pipe(
    Stream.filter(isCompactedMergeRequestsDependentEvent),
    Stream.scan(
      new Map<string, CompactedMergeRequestEntry>(),
      (state, event) => projectMergeRequests(state, event)
    ),
  )
})

export const persistCompactedState = (state: CompactedMergeRequestsState) =>
  Effect.gen(function* () {
    const mrs = Array.from(state.values()).map(entry => entry.mr)

    const compactedEvent: MergeRequestsCompactedEvent = {
      type: 'mergerequests-compacted-event' as const,
      mrs
    }

    yield* EventStorage.appendEvent(compactedEvent)

    return mrs.length
  })
