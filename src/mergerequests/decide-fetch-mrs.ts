import { Effect, Data, Console } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import { EventStorage } from "../events/events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlab-graphql"
import type { JiraApiError } from "../jira/jira-common"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent, getSingleMrAsEvent, getMrsAsEvent } from "../gitlab/gitlab-graphql"
import { loadJiraTicketsAsEvent } from "../jira/jira-service"
import { projectGitlabProjectMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabUserMrsFetchedEvent } from "../gitlab/gitlab-projections"
import type { MergeRequest } from "./mergerequest-schema"
import type { MrGid } from "../gitlab/gitlab-schema"

export class MRCacheKey extends Data.TaggedClass("UserMRs")<{
  readonly usernames: readonly string[]
  readonly state: MergeRequestState
}> {}

export class ProjectMRCacheKey extends Data.TaggedClass("ProjectMRs")<{
  readonly projectPath: string
  readonly state: MergeRequestState
}> {}

export type CacheKey = MRCacheKey | ProjectMRCacheKey

export type MergeRequestsCacheError =
  | string
  | FetchGitlabMrsError
  | FetchGitlabProjectMrsError
  | JiraApiError
  | BitbucketCredentialsNotConfiguredError
  | FetchBitbucketPrsError
  | BitbucketPrsJsonParseError
  | PlatformError
  | ParseError

export type KnownMrInfo = { projectPath: string; iid: string };

export const mrMatchesCacheKey = (mr: MergeRequest, cacheKey: CacheKey): boolean =>
  mr.state === cacheKey.state &&
  (cacheKey._tag === "UserMRs"
    ? cacheKey.usernames.includes(mr.author)
    : mr.project.fullPath === cacheKey.projectPath);

export const getKnownMrsForCacheKey = (
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>,
  cacheKey: CacheKey
): ReadonlyMap<MrGid, KnownMrInfo> =>
  new Map(
    [...mrsByGid.entries()]
      .filter(([, mr]) => mrMatchesCacheKey(mr, cacheKey))
      .map(([gid, mr]) => [gid, { projectPath: mr.project.fullPath, iid: mr.iid }])
  );

const fetchMissingMrs = (missingMrs: readonly KnownMrInfo[]) => Effect.gen(function* () {
  const byProject = missingMrs.reduce(
    (acc, mr) => acc.set(mr.projectPath, [...(acc.get(mr.projectPath) ?? []), mr.iid]),
    new Map<string, string[]>()
  )

  yield* Effect.forEach(
    [...byProject.entries()],
    ([projectPath, iids]) => Effect.gen(function* () {
      yield* Console.log(`[Fetch] Fetching ${iids.length} missing MRs for ${projectPath}`)
      const event = yield* getMrsAsEvent(projectPath, iids)
      yield* EventStorage.appendEvent(event)
    }).pipe(
      Effect.catchAll(err => Console.error(`[Fetch] Failed to fetch MRs for ${projectPath}`, err))
    ),
    { concurrency: 3 }
  )
})

const forkFetchMissingMrs = (
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>,
  fetchedGids: ReadonlySet<MrGid>
) => Effect.gen(function* () {
  if (knownMrs.size === 0) return

  const missingMrs = [...knownMrs.entries()]
    .filter(([gid]) => !fetchedGids.has(gid))
    .map(([, info]) => info)

    console.log("missing", missingMrs.length)

  if (missingMrs.length > 0) {
    yield* Effect.forkDaemon(
      Console.log(`[Fetch] ${missingMrs.length} known MRs not in response, fetching in background`).pipe(
        Effect.andThen(fetchMissingMrs(missingMrs))
      )
    )
  }
})

export const decideFetchUserMrs = (
  usernames: string[],
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>
): Effect.Effect<
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const mrEvent = yield* getGitlabMrsAsEvent(usernames, state)
  yield* EventStorage.appendEvent(mrEvent)

  const gitlabMrs = projectGitlabUserMrsFetchedEvent(mrEvent)

  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)

  if (state === 'opened') {
    yield* forkFetchMissingMrs(knownMrs, new Set(gitlabMrs.map(mr => mr.id)))
  }
})

export const decideFetchProjectMrs = (
  projectPath: string,
  state: MergeRequestState,
  knownMrs: ReadonlyMap<MrGid, KnownMrInfo>
): Effect.Effect<
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const mrEvent = yield* getGitlabMrsByProjectAsEvent(projectPath, state);
  yield* EventStorage.appendEvent(mrEvent)

  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)

  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)

  if (state === 'opened') {
    yield* forkFetchMissingMrs(knownMrs, new Set(gitlabMrs.map(mr => mr.id)))
  }
})

export const decideFetchSingleMr = Effect.fn(function* (projectFullPath: string, mrIid) {
  const mrEvent = yield* getSingleMrAsEvent(projectFullPath, mrIid);
  yield* EventStorage.appendEvent(mrEvent);
  const gitlabMr = projectGitlabSingleMrFetchedEvent(mrEvent);
  return gitlabMr;
});