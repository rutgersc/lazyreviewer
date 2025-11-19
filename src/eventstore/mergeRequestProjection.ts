import { Effect, Stream } from "effect"
import type { MergeRequest } from "../mergerequests/mergerequest-schema"
import type { GitlabMergeRequest } from "../gitlab/gitlab-schema"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import type { Event } from "../events/events"
import type { MergeRequestsCompactedEvent } from "../events/event-compaction-events"
import { EventStorage } from "./eventStorage"
import {
  projectGitlabUserMrsFetchedEvent,
  projectGitlabProjectMrsFetchedEvent,
  projectGitlabSingleMrFetchedEvent
} from "../gitlab/gitlab-projections"
import type {
  GitlabUserMergeRequestsFetchedEvent,
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from "../events/gitlab-events"

export type CompactedMergeRequestsDependentEvents =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent

export interface CompactedMergeRequestEntry {
  mr: MergeRequest
  forUsernames: string[]
  forState: MergeRequestState
  forProjectPath: string
  forMrId: string
}

export type CompactedMergeRequestsState = Map<string, CompactedMergeRequestEntry>

const gitlabMergeRequestToMergeRequest = (gitlabMr: GitlabMergeRequest): MergeRequest => ({
  ...gitlabMr,
  jiraIssues: []
})

const getMrKey = (projectPath: string, mrId: string): string =>
  `${projectPath}::${mrId}`

export const projectMergeRequests = (
  state: CompactedMergeRequestsState,
  event: CompactedMergeRequestsDependentEvents
): CompactedMergeRequestsState => {
  const newState = new Map(state)

  switch (event.type) {
    case 'gitlab-user-mrs-fetched-event': {
      const gitlabMrs = projectGitlabUserMrsFetchedEvent(event)

      gitlabMrs.forEach(gitlabMr => {
        const key = getMrKey(gitlabMr.project.fullPath, gitlabMr.iid)
        newState.set(key, {
          mr: gitlabMergeRequestToMergeRequest(gitlabMr),
          forUsernames: event.forUsernames,
          forState: event.forState,
          forProjectPath: gitlabMr.project.fullPath,
          forMrId: gitlabMr.iid
        })
      })

      return newState
    }

    case 'gitlab-project-mrs-fetched-event': {
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event)

      gitlabMrs.forEach(gitlabMr => {
        const key = getMrKey(gitlabMr.project.fullPath, gitlabMr.iid)
        newState.set(key, {
          mr: gitlabMergeRequestToMergeRequest(gitlabMr),
          forUsernames: [gitlabMr.author],
          forState: event.forState,
          forProjectPath: event.forProjectPath,
          forMrId: gitlabMr.iid
        })
      })

      return newState
    }

    case 'gitlab-single-mr-fetched-event': {
      const gitlabMr = projectGitlabSingleMrFetchedEvent(event)

      if (!gitlabMr) {
        return newState
      }

      const key = getMrKey(gitlabMr.project.fullPath, gitlabMr.iid)
      newState.set(key, {
        mr: gitlabMergeRequestToMergeRequest(gitlabMr),
        forUsernames: [gitlabMr.author],
        forState: 'all',
        forProjectPath: event.forProjectPath,
        forMrId: event.forMrId
      })

      return newState
    }
  }
}

const isCompactedMergeRequestsDependentEvent = (event: Event): event is CompactedMergeRequestsDependentEvents =>
  event.type === 'gitlab-user-mrs-fetched-event' ||
  event.type === 'gitlab-project-mrs-fetched-event' ||
  event.type === 'gitlab-single-mr-fetched-event'

export const buildCompactedStateFromFirst10Events = Effect.gen(function* () {
  const eventStorage = yield* EventStorage

  const finalState = yield* eventStorage.eventsStream.pipe(
    Stream.filter(isCompactedMergeRequestsDependentEvent),
    Stream.take(10),
    Stream.scan(
      new Map<string, CompactedMergeRequestEntry>(),
      (state, event) => projectMergeRequests(state, event)
    ),
    Stream.runLast
  )

  return finalState ?? new Map<string, CompactedMergeRequestEntry>()
})

export const persistCompactedState = (state: CompactedMergeRequestsState) =>
  Effect.gen(function* () {
    const eventStorage = yield* EventStorage

    const mrs = Array.from(state.values()).map(entry => entry.mr)

    const compactedEvent: MergeRequestsCompactedEvent = {
      type: 'mergerequests-compacted-event' as const,
      mrs
    }

    yield* eventStorage.appendEvent(compactedEvent)

    return mrs.length
  })
