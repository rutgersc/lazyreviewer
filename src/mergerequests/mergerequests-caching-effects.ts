import { Effect, Data, Console } from "effect"
import { type MergeRequest } from "../schemas/mergeRequestSchema"
import { fetchMergeRequestsByProjectEffect, fetchMergeRequests } from "./mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"
import { MergeRequestStorage } from "../services/mergeRequestStorage"

export class MRCacheKey extends Data.TaggedClass("UserMRs")<{
  readonly usernames: readonly string[]
  readonly state: MergeRequestState
}> {}

export class ProjectMRCacheKey extends Data.TaggedClass("ProjectMRs")<{
  readonly projectPath: string
  readonly state: MergeRequestState
}> {}

export type CacheKey = MRCacheKey | ProjectMRCacheKey

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

export const fetchUserMRsWithCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}, ${cached.value[0]?.targetbranch}`)
    return cached.value satisfies Readonly<MergeRequest[]>
  }

  yield* Console.log(`[Cache] MISS: ${cacheKey}`)

  const fresh = (yield* fetchMergeRequests(key.usernames))
  yield* storage.set(cacheKey, fresh);
  return fresh
})

export const fetchProjectMRsWithCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}`)
    return cached.value
  }

  yield* Console.log(`[Cache] Miss: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProjectEffect(key)
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

export const forceRefreshUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)
  const fresh = (yield* fetchMergeRequests(key.usernames))
  yield* storage.set(cacheKey, fresh)

  return fresh
})

export const forceRefreshProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProjectEffect(key)
  yield* storage.set(cacheKey, fresh)

  return fresh
})