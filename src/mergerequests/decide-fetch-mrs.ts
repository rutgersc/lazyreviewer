import { Effect, Data, Console, Config } from "effect"
import type { PlatformError } from "effect/PlatformError"
import type { SchemaError } from "effect/Schema"
import type { MergeRequestState } from "../domain/merge-request-state"
import { EventStorage } from "../events/events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError, FetchSingleMrError, FetchMrStampsError } from "../gitlab/gitlab-graphql"
import type { JiraApiError } from "../jira/jira-common"
import type { UnauthorizedError } from "../domain/unauthorized-error"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent, getAllGitlabMrsByProjectAsEvents, getSingleMrAsEvent, getMrsAsEvent, MR_DETAIL_PAGE_LIMIT } from "../gitlab/gitlab-graphql"
import { getBitbucketPrsAsEvent } from "../bitbucket/bitbucketapi"
import { loadJiraTicketsAsEvent } from "../jira/jira-service"
import { projectGitlabMrsFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabUserMrsFetchedEvent } from "../gitlab/gitlab-projections"
import { projectBitbucketPrsFetchedEvent } from "../bitbucket/bitbucket-projections"
import { type RepositoryId, type UserId, isCurrentUser, mrProviderAuthor, repositoryFullPath } from "../userselection/userSelection"
import type { MergeRequest } from "./mergerequest-schema"
import type { MrGid } from "../domain/identifiers"

export class MRCacheKey extends Data.TaggedClass("UserMRs")<{
  readonly users: readonly UserId[]
  readonly state: MergeRequestState
}> {}

export class ProjectMRCacheKey extends Data.TaggedClass("ProjectMRs")<{
  readonly repository: RepositoryId
  readonly state: MergeRequestState
}> {}

export type CacheKey = MRCacheKey | ProjectMRCacheKey

export type MergeRequestsCacheError =
  | string
  | FetchGitlabMrsError
  | FetchGitlabProjectMrsError
  | FetchSingleMrError
  | FetchMrStampsError
  | JiraApiError
  | UnauthorizedError
  | BitbucketCredentialsNotConfiguredError
  | FetchBitbucketPrsError
  | BitbucketPrsJsonParseError
  | PlatformError
  | SchemaError
  | Config.ConfigError

export type KnownMrInfo = { projectPath: string; iid: string; updatedAt: Date };

export const mrMatchesCacheKey = (mr: MergeRequest, cacheKey: CacheKey): boolean =>
  mr.state === cacheKey.state &&
  (cacheKey._tag === "UserMRs"
    ? cacheKey.users.some(u => isCurrentUser(u, mrProviderAuthor(mr.provider, mr.author)))
    : mr.project.fullPath === repositoryFullPath(cacheKey.repository));

export const getKnownMrsForCacheKey = (
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>,
  cacheKey: CacheKey
): ReadonlyMap<MrGid, KnownMrInfo> =>
  new Map(
    [...mrsByGid.entries()]
      .filter(([, mr]) => mrMatchesCacheKey(mr, cacheKey))
      .map(([gid, mr]) => [gid, { projectPath: mr.project.fullPath, iid: mr.iid, updatedAt: mr.updatedAt }])
  );

// One GitlabMRs request may only ask for MR_DETAIL_PAGE_LIMIT MRs before GitLab rejects it on query
// complexity, so every caller of getMrsAsEvent splits its iids first.
const batchIids = (iids: readonly string[]): string[][] =>
  iids.reduce<string[][]>((acc, iid) => {
    const last = acc[acc.length - 1]
    if (!last || last.length >= MR_DETAIL_PAGE_LIMIT) acc.push([iid])
    else last.push(iid)
    return acc
  }, [])

const fetchMissingMrs = (missingMrs: readonly KnownMrInfo[]) => Effect.gen(function* () {
  const byProject = missingMrs.reduce(
    (acc, mr) => acc.set(mr.projectPath, [...(acc.get(mr.projectPath) ?? []), mr.iid]),
    new Map<string, string[]>()
  )

  const jiraKeysByProject = yield* Effect.forEach(
    [...byProject.entries()],
    ([projectPath, iids]) => Effect.gen(function* () {
      const eventStorage = yield* EventStorage
      yield* Console.log(`[Fetch] Fetching ${iids.length} missing MRs for ${projectPath}`)
      const keysPerBatch = yield* Effect.forEach(batchIids(iids), batch => Effect.gen(function* () {
        const event = yield* getMrsAsEvent(projectPath, batch)
        yield* eventStorage.appendEvent(event)
        return projectGitlabMrsFetchedEvent(event).flatMap(mr => mr.jiraIssueKeys)
      }))
      return keysPerBatch.flat()
    }).pipe(
      Effect.catch(err =>
        Console.error(`[Fetch] Failed to fetch MRs for ${projectPath}`, err).pipe(
          Effect.as([] as string[])
        )
      )
    ),
    { concurrency: 3 }
  )

  return Array.from(new Set(jiraKeysByProject.flat()))
})

const fetchJiraForKeys = (jiraKeys: readonly string[]) => Effect.gen(function* () {
  const eventStorage = yield* EventStorage
  yield* Console.log(`[Fetch] Fetching ${jiraKeys.length} Jira tickets for reconciled MRs`)
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys as string[])
  yield* eventStorage.appendEvent(jiraEvent)
})

// Tier 2 of the sweep: full-fidelity fetch for the MRs a stamp diff flagged. Awaited rather than
// forked so the caller's fetch lock still covers the writes.
export const fetchMrDetails = (
  projectPath: string,
  iids: readonly string[]
): Effect.Effect<void, MergeRequestsCacheError, EventStorage> => Effect.gen(function* () {
  if (iids.length === 0) return

  const eventStorage = yield* EventStorage
  const batches = batchIids(iids)

  yield* Console.log(`[Fetch] Detail fetch for ${iids.length} MRs in ${projectPath} (${batches.length} batch(es))`)

  const jiraKeysPerBatch = yield* Effect.forEach(
    batches,
    batch => Effect.gen(function* () {
      const event = yield* getMrsAsEvent(projectPath, batch)
      yield* eventStorage.appendEvent(event)
      return projectGitlabMrsFetchedEvent(event).flatMap(mr => mr.jiraIssueKeys)
    }),
    { concurrency: 2 }
  )

  const jiraKeys = [...new Set(jiraKeysPerBatch.flat())]
  if (jiraKeys.length > 0) yield* fetchJiraForKeys(jiraKeys)
})

const forkFetchMissingMrs = (
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>,
  fetchedGids: ReadonlySet<MrGid>
) => Effect.gen(function* () {
  if (knownMrs.size === 0) return

  const missingMrs = [...knownMrs.entries()]
    .filter(([gid]) => !fetchedGids.has(gid))
    .map(([, info]) => info)

  if (missingMrs.length > 0) {
    yield* Effect.forkDetach(
      Console.log(`[Fetch] ${missingMrs.length} known MRs not in response, fetching in background`).pipe(
        Effect.andThen(fetchMissingMrs(missingMrs)),
        Effect.tap(jiraKeys =>
          jiraKeys.length > 0
            ? Effect.forkDetach(fetchJiraForKeys(jiraKeys))
            : Effect.void
        )
      )
    )
  }
})

export const decideFetchUserMrs = (
  users: readonly UserId[],
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>
): Effect.Effect<
  readonly string[],
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const eventStorage = yield* EventStorage
  const gitlabUsernames = users.map(u => u.gitlab).filter((g): g is string => g !== undefined)

  const fetchAndAppend = (fetchState: MergeRequestState, first?: number) =>
    Effect.gen(function* () {
      const event = yield* getGitlabMrsAsEvent(gitlabUsernames, fetchState, first)
      yield* eventStorage.appendEvent(event)
      return event
    })

  const mrEvent = state === 'opened'
    ? (yield* Effect.all([fetchAndAppend(state), fetchAndAppend('merged', 10)], { concurrency: 2 }))[0]
    : yield* fetchAndAppend(state)

  const gitlabMrs = projectGitlabUserMrsFetchedEvent(mrEvent)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* eventStorage.appendEvent(jiraEvent)

  return [...new Set(gitlabMrs.map(mr => mr.project.fullPath))]
})

export type PageFetchResult = {
  readonly hasNextPage: boolean
  readonly endCursor: string | null
  readonly mrCount: number
  readonly fetchedGids: ReadonlySet<MrGid>
}

export const extractKnownProjects = (mrsByGid: ReadonlyMap<MrGid, MergeRequest>): readonly RepositoryId[] => {
  const seen = new Map<string, RepositoryId>();
  for (const mr of mrsByGid.values()) {
    const key = mr.project.fullPath;
    if (!seen.has(key)) {
      seen.set(key, mr.provider === 'bitbucket'
        ? { type: 'repositoryId', provider: 'bitbucket', workspace: key.split('/')[0] ?? '', repo: key.split('/')[1] ?? '' }
        : { type: 'repositoryId', provider: 'gitlab', id: key }
      );
    }
  }
  return [...seen.values()];
}

export const fetchRepoPage = (
  repository: RepositoryId,
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>,
  afterCursor: string | null,
  pageSize: number = 50,
): Effect.Effect<
  PageFetchResult,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const eventStorage = yield* EventStorage

  if (repository.provider === 'bitbucket') {
    const bbEvent = yield* getBitbucketPrsAsEvent(repository.workspace, repository.repo, state)
    yield* eventStorage.appendEvent(bbEvent)
    const mrs = projectBitbucketPrsFetchedEvent(bbEvent, new Map())
    const fetchedGids = new Set(mrs.map(mr => mr.id))

    if (state === 'opened') {
      yield* forkFetchMissingMrs(knownMrs, fetchedGids)
    }

    const jiraKeys = Array.from(new Set(mrs.flatMap(mr => mr.jiraIssueKeys)))
    if (jiraKeys.length > 0) {
      const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
      yield* eventStorage.appendEvent(jiraEvent)
    }

    return { hasNextPage: false, endCursor: null, mrCount: mrs.length, fetchedGids }
  }

  const mrEvent = yield* getGitlabMrsByProjectAsEvent(repository.id, state, afterCursor, pageSize)
  yield* eventStorage.appendEvent(mrEvent)
  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)
  const pageInfo = mrEvent.mrs.project?.mergeRequests?.pageInfo
  const hasNextPage = pageInfo?.hasNextPage ?? false
  const endCursor = pageInfo?.endCursor ?? null
  const fetchedGids = new Set(gitlabMrs.map(mr => mr.id))

  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  if (jiraKeys.length > 0) {
    const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
    yield* eventStorage.appendEvent(jiraEvent)
  }

  return { hasNextPage, endCursor, mrCount: gitlabMrs.length, fetchedGids }
})

export const deepFetchProjectMrs = (
  repository: RepositoryId,
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>
): Effect.Effect<void, MergeRequestsCacheError, EventStorage> =>
  Effect.gen(function* () {
    const eventStorage = yield* EventStorage
    if (repository.provider === 'bitbucket') {
      yield* fetchRepoPage(repository, state, knownMrs, null)
      return
    }

    const events = yield* getAllGitlabMrsByProjectAsEvents(repository.id, state)
    const allMrs = events.flatMap(event => projectGitlabProjectMrsFetchedEvent(event))

    yield* Effect.forEach(events, event => eventStorage.appendEvent(event))

    if (state === 'opened') {
      const fetchedGids = new Set(allMrs.map(mr => mr.id))
      yield* forkFetchMissingMrs(knownMrs, fetchedGids)
    }

    const jiraKeys = Array.from(new Set(allMrs.flatMap(mr => mr.jiraIssueKeys)))
    if (jiraKeys.length > 0) {
      const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
      yield* eventStorage.appendEvent(jiraEvent)
    }
  })

export const decideFetchSingleMr = Effect.fn(function* (projectFullPath: string, mrIid) {
  const eventStorage = yield* EventStorage
  const mrEvent = yield* getSingleMrAsEvent(projectFullPath, mrIid);
  yield* eventStorage.appendEvent(mrEvent);
  const gitlabMr = projectGitlabSingleMrFetchedEvent(mrEvent);
  return gitlabMr;
});