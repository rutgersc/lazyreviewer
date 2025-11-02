import { Effect, Data, Console, Context } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import { type MergeRequest } from "../schemas/mergeRequestSchema"
import { fetchMergeRequestsByProject, fetchMergeRequests } from "./mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"
import { MergeRequestStorage } from "../services/mergeRequestStorage"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlabgraphql"
import type { SearchJiraIssuesError } from "../jira/jiraService"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"

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
  | SearchJiraIssuesError
  | BitbucketCredentialsNotConfiguredError
  | FetchBitbucketPrsError
  | BitbucketPrsJsonParseError
  | PlatformError
  | ParseError

const toCacheKeyString = (key: MRCacheKey): string => {
  const usernamesStr = key.usernames.join('_')
  return `mrs_${key.state}_${usernamesStr}_gitlab`
}

const toProjectCacheKeyString = (key: ProjectMRCacheKey): string => {
  const fixedProject = key.projectPath
    .replace(/:/g, '_')
    .replace(/\//g, '_')
  return `mrs_${key.state}_${fixedProject}_gitlab`
}


export const fetchUserMRsWithCache = (key: MRCacheKey): Effect.Effect<
  readonly MergeRequest[],
  MergeRequestsCacheError,
  MergeRequestStorage
> => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}, ${cached.value[0]?.targetbranch}`)
    return cached.value as readonly MergeRequest[];
  }

  yield* Console.log(`[Cache] MISS: ${cacheKey}`)

  const fresh = (yield* fetchMergeRequests(key.usernames))
  yield* storage.set(cacheKey, fresh);
  return fresh
})

const test = MergeRequestStorage.get("test");

export const fetchProjectMRsWithCache = (key: ProjectMRCacheKey): Effect.Effect<
  readonly MergeRequest[],
  MergeRequestsCacheError,
  MergeRequestStorage
> => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)

  const cached = yield* MergeRequestStorage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}`)
    return cached.value as  readonly MergeRequest[];
  }

  yield* Console.log(`[Cache] Miss: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProject(key)
  yield* MergeRequestStorage.set(cacheKey, fresh)
  return fresh
});

export const forceRefreshUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)
  const fresh = (yield* fetchMergeRequests(key.usernames))
  yield* storage.set(cacheKey, fresh)

  return fresh
})






export const invalidateUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  yield* Console.log(`[Cache] Invalidated: ${cacheKey}`)
})

export const invalidateProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  yield* Console.log(`[Cache] Invalidated: ${cacheKey}`)
})



export const forceRefreshProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProject(key)
  yield* storage.set(cacheKey, fresh)

  return fresh
})