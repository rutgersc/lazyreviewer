import { Effect, Data, Console } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import type { MergeRequestState } from "../domain/merge-request-state"
import { EventStorage } from "../events/events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlab-graphql"
import type { JiraApiError } from "../jira/jira-common"
import type { UnauthorizedError } from "../domain/unauthorized-error"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent, getAllGitlabMrsByProjectAsEvents, getSingleMrAsEvent, getMrsAsEvent } from "../gitlab/gitlab-graphql"
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
  | JiraApiError
  | UnauthorizedError
  | BitbucketCredentialsNotConfiguredError
  | FetchBitbucketPrsError
  | BitbucketPrsJsonParseError
  | PlatformError
  | ParseError

export type KnownMrInfo = { projectPath: string; iid: string; updatedAt: Date };

export const mrMatchesCacheKey = (mr: MergeRequest, cacheKey: CacheKey): boolean =>
  mr.state === cacheKey.state &&
  (cacheKey._tag === "UserMRs"
    ? cacheKey.users.some(u => isCurrentUser(u, mrProviderAuthor(mr.provider, mr.author)))
    : mr.project.fullPath === repositoryFullPath(cacheKey.repository));

export const mrMatchesFilter = (
  mr: MergeRequest,
  state: MergeRequestState,
  authors: readonly UserId[],
  repos: readonly RepositoryId[]
): boolean =>
  mr.state === state
  && (repos.length === 0 || repos.some(r => mr.project.fullPath === repositoryFullPath(r)))
  && (authors.length === 0 || authors.some(u => isCurrentUser(u, mrProviderAuthor(mr.provider, mr.author))));

export const getKnownMrsForCacheKey = (
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>,
  cacheKey: CacheKey
): ReadonlyMap<MrGid, KnownMrInfo> =>
  new Map(
    [...mrsByGid.entries()]
      .filter(([, mr]) => mrMatchesCacheKey(mr, cacheKey))
      .map(([gid, mr]) => [gid, { projectPath: mr.project.fullPath, iid: mr.iid, updatedAt: mr.updatedAt }])
  );

const fetchMissingMrs = (missingMrs: readonly KnownMrInfo[]) => Effect.gen(function* () {
  const byProject = missingMrs.reduce(
    (acc, mr) => acc.set(mr.projectPath, [...(acc.get(mr.projectPath) ?? []), mr.iid]),
    new Map<string, string[]>()
  )

  const jiraKeysByProject = yield* Effect.forEach(
    [...byProject.entries()],
    ([projectPath, iids]) => Effect.gen(function* () {
      yield* Console.log(`[Fetch] Fetching ${iids.length} missing MRs for ${projectPath}`)
      const event = yield* getMrsAsEvent(projectPath, iids)
      yield* EventStorage.appendEvent(event)
      return projectGitlabMrsFetchedEvent(event).flatMap(mr => mr.jiraIssueKeys)
    }).pipe(
      Effect.catchAll(err =>
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
  yield* Console.log(`[Fetch] Fetching ${jiraKeys.length} Jira tickets for reconciled MRs`)
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys as string[])
  yield* EventStorage.appendEvent(jiraEvent)
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
    yield* Effect.forkDaemon(
      Console.log(`[Fetch] ${missingMrs.length} known MRs not in response, fetching in background`).pipe(
        Effect.andThen(fetchMissingMrs(missingMrs)),
        Effect.tap(jiraKeys =>
          jiraKeys.length > 0
            ? Effect.forkDaemon(fetchJiraForKeys(jiraKeys))
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
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const gitlabUsernames = users.map(u => u.gitlab).filter((g): g is string => g !== undefined)
  const mrEvent = yield* getGitlabMrsAsEvent(gitlabUsernames, state)
  yield* EventStorage.appendEvent(mrEvent)

  const gitlabMrs = projectGitlabUserMrsFetchedEvent(mrEvent)

  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)

  const anyHasNextPage = mrEvent.mrs.users?.nodes?.some(
    user => user?.authoredMergeRequests?.pageInfo?.hasNextPage
  ) ?? false
  if (state === 'opened') {
    if (anyHasNextPage) {
      yield* Console.log(`[Fetch] Skipping missing-MR check for users: response was paginated`)
    } else {
      yield* forkFetchMissingMrs(knownMrs, new Set(gitlabMrs.map(mr => mr.id)))
    }
  }
})

export type PageFetchResult = {
  readonly hasNextPage: boolean
  readonly endCursor: string | null
  readonly oldestUpdatedAt: Date | undefined
  readonly newestUpdatedAt: Date | undefined
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
  shallowerPageGids: ReadonlySet<MrGid> = new Set(),
  pageSize: number = 50,
): Effect.Effect<
  PageFetchResult,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const isPage1 = afterCursor === null

  if (repository.provider === 'bitbucket') {
    const bbEvent = yield* getBitbucketPrsAsEvent(repository.workspace, repository.repo, state)
    yield* EventStorage.appendEvent(bbEvent)
    const mrs = projectBitbucketPrsFetchedEvent(bbEvent, new Map())
    const fetchedGids = new Set(mrs.map(mr => mr.id))
    const oldestUpdatedAt = mrs.length > 0 ? mrs.reduce((oldest, mr) => mr.updatedAt < oldest ? mr.updatedAt : oldest, mrs[0]!.updatedAt) : undefined
    const newestUpdatedAt = mrs.length > 0 ? mrs.reduce((newest, mr) => mr.updatedAt > newest ? mr.updatedAt : newest, mrs[0]!.updatedAt) : undefined

    if (state === 'opened') {
      yield* forkFetchMissingMrs(knownMrs, fetchedGids)
    }

    const jiraKeys = Array.from(new Set(mrs.flatMap(mr => mr.jiraIssueKeys)))
    if (jiraKeys.length > 0) {
      const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
      yield* EventStorage.appendEvent(jiraEvent)
    }

    return { hasNextPage: false, endCursor: null, oldestUpdatedAt, newestUpdatedAt, mrCount: mrs.length, fetchedGids }
  }

  const mrEvent = yield* getGitlabMrsByProjectAsEvent(repository.id, state, afterCursor, pageSize)
  yield* EventStorage.appendEvent(mrEvent)
  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)
  const pageInfo = mrEvent.mrs.project?.mergeRequests?.pageInfo
  const hasNextPage = pageInfo?.hasNextPage ?? false
  const endCursor = pageInfo?.endCursor ?? null
  const fetchedGids = new Set(gitlabMrs.map(mr => mr.id))

  // Results are sorted by UPDATED_DESC — last element has oldest updatedAt, first has newest.
  const oldestUpdatedAt = gitlabMrs.length > 0 ? gitlabMrs[gitlabMrs.length - 1]!.updatedAt : undefined
  const newestUpdatedAt = gitlabMrs.length > 0 ? gitlabMrs[0]!.updatedAt : undefined

  if (state === 'opened') {
    // Compute date-range for this page's reconciliation window
    const floor = hasNextPage ? oldestUpdatedAt : undefined
    const ceiling = !isPage1 ? newestUpdatedAt : undefined

    const reconcilableMrs = new Map(
      [...knownMrs.entries()].filter(([gid, info]) => {
        if (floor !== undefined && info.updatedAt <= floor) return false
        if (ceiling !== undefined && info.updatedAt > ceiling) return false
        return true
      })
    )

    // Filter out MRs that moved to a shallower page (updatedAt only moves forward)
    const trulyMissing = new Map(
      [...reconcilableMrs.entries()].filter(([gid]) =>
        !fetchedGids.has(gid) && !shallowerPageGids.has(gid)
      )
    )

    if (trulyMissing.size > 0) {
      yield* forkFetchMissingMrs(trulyMissing, fetchedGids)
    }
  }

  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  if (jiraKeys.length > 0) {
    const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
    yield* EventStorage.appendEvent(jiraEvent)
  }

  return { hasNextPage, endCursor, oldestUpdatedAt, newestUpdatedAt, mrCount: gitlabMrs.length, fetchedGids }
})

export const deepFetchProjectMrs = (
  repository: RepositoryId,
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>
): Effect.Effect<void, MergeRequestsCacheError, EventStorage> =>
  Effect.gen(function* () {
    if (repository.provider === 'bitbucket') {
      yield* fetchRepoPage(repository, state, knownMrs, null)
      return
    }

    const events = yield* getAllGitlabMrsByProjectAsEvents(repository.id, state)
    const allMrs = events.flatMap(event => projectGitlabProjectMrsFetchedEvent(event))

    yield* Effect.forEach(events, event => EventStorage.appendEvent(event))

    if (state === 'opened') {
      const fetchedGids = new Set(allMrs.map(mr => mr.id))
      yield* forkFetchMissingMrs(knownMrs, fetchedGids)
    }

    const jiraKeys = Array.from(new Set(allMrs.flatMap(mr => mr.jiraIssueKeys)))
    if (jiraKeys.length > 0) {
      const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
      yield* EventStorage.appendEvent(jiraEvent)
    }
  })

export const decideFetchSingleMr = Effect.fn(function* (projectFullPath: string, mrIid) {
  const mrEvent = yield* getSingleMrAsEvent(projectFullPath, mrIid);
  yield* EventStorage.appendEvent(mrEvent);
  const gitlabMr = projectGitlabSingleMrFetchedEvent(mrEvent);
  return gitlabMr;
});