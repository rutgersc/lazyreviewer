import { Data, Effect, ServiceMap, Stream, SubscriptionRef, Chunk } from "effect"
import type { MrGid } from "../domain/identifiers"
import type { MergeRequestState } from "../domain/merge-request-state"
import type { RepositoryId } from "../userselection/userSelection"
import { projectGitlabUserMrsFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabMrsFetchedEvent } from "../gitlab/gitlab-projections"
import { projectBitbucketPrsFetchedEvent } from "../bitbucket/bitbucket-projections"
import { defineProjection } from "../utils/define-projection"
import { EventStorage } from "../events/events"

export type MrFreshness = {
  readonly repo: string
  readonly updatedAt: Date
  readonly iid: string
  readonly state: MergeRequestState
}

export class BgSyncReadModel extends Data.TaggedClass("BgSyncReadModel")<{
  readonly mrFreshnessById: ReadonlyMap<MrGid, MrFreshness>
  readonly knownProjects: ReadonlyMap<string, RepositoryId>
  readonly seq: number
}> {}

const extractFreshness = (mr: { id: MrGid; iid: string; state: string; updatedAt: Date; project: { fullPath: string }; provider: string }): [MrGid, MrFreshness] =>
  [mr.id, { repo: mr.project.fullPath, updatedAt: mr.updatedAt, iid: mr.iid, state: mr.state as MergeRequestState }]

const extractProject = (mr: { project: { fullPath: string }; provider: string }): [string, RepositoryId] => {
  const key = mr.project.fullPath
  return [key, mr.provider === 'bitbucket'
    ? { type: 'repositoryId', provider: 'bitbucket', workspace: key.split('/')[0] ?? '', repo: key.split('/')[1] ?? '' }
    : { type: 'repositoryId', provider: 'gitlab', id: key }
  ]
}

const applyMrs = (
  state: BgSyncReadModel,
  mrs: readonly { id: MrGid; iid: string; state: string; updatedAt: Date; project: { fullPath: string }; provider: string }[],
): BgSyncReadModel => {
  const freshness = new Map(state.mrFreshnessById)
  const projects = new Map(state.knownProjects)
  mrs.forEach(mr => {
    const [gid, f] = extractFreshness(mr)
    freshness.set(gid, f)
    const [key, repo] = extractProject(mr)
    if (!projects.has(key)) projects.set(key, repo)
  })
  return new BgSyncReadModel({ mrFreshnessById: freshness, knownProjects: projects, seq: state.seq })
}

const initialBgSyncReadModel = new BgSyncReadModel({
  mrFreshnessById: new Map(),
  knownProjects: new Map(),
  seq: 0,
})

export const bgSyncProjection = defineProjection({
  initialState: initialBgSyncReadModel,
  handlers: {
    "gitlab-user-mrs-fetched-event": (state, event) =>
      applyMrs(state, projectGitlabUserMrsFetchedEvent(event)),

    "gitlab-single-mr-fetched-event": (state, event) => {
      const mr = projectGitlabSingleMrFetchedEvent(event)
      return mr ? applyMrs(state, [mr]) : state
    },

    "gitlab-mrs-fetched-event": (state, event) =>
      applyMrs(state, projectGitlabMrsFetchedEvent(event)),

    "gitlab-project-mrs-fetched-event": (state, event) =>
      applyMrs(state, projectGitlabProjectMrsFetchedEvent(event)),

    "bitbucket-prs-fetched-event": (state, event) =>
      applyMrs(state, projectBitbucketPrsFetchedEvent(event, new Map())),
  }
})

export class BgSyncReadModelService extends ServiceMap.Service<BgSyncReadModelService>()("BgSyncReadModelService", {
  make: Effect.gen(function* () {
    const stateRef = yield* SubscriptionRef.make(bgSyncProjection.initialState)
    const eventStorage = yield* EventStorage

    yield* eventStorage.eventsStream.pipe(
      Stream.groupedWithin(200, "0.33 seconds"),
      Stream.scan(bgSyncProjection.initialState, (state, events) => {
        const relevant = Chunk.toArray(events).filter(bgSyncProjection.isRelevantEvent)
        const projected = relevant.reduce((s, e) => bgSyncProjection.project(s, e), state)
        return new BgSyncReadModel({
          mrFreshnessById: projected.mrFreshnessById,
          knownProjects: projected.knownProjects,
          seq: state.seq + Chunk.size(events),
        })
      }),
      Stream.runForEach((state) => SubscriptionRef.set(stateRef, state)),
      Effect.forkScoped
    )

    return {
      get: SubscriptionRef.get(stateRef),
      changes: SubscriptionRef.changes(stateRef)
    }
  })
}) {}
