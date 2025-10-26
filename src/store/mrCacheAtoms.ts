import { Atom } from "@effect-atom/atom"
import { Effect, Data, Schema } from "effect"
import { MergeRequestSchema, type MergeRequest } from "../schemas/mergeRequestSchema"
import { fetchMergeRequestsByProjectEffect, fetchMergeRequestsEffect } from "../mergerequests/mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import { cacheRuntime } from "./appAtoms"

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

const fetchUserMRsWithCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(Schema.Array(MergeRequestSchema))

  const cached = yield* schemaStore.get(cacheKey);
  if (cached._tag === "Some") {
    console.log(`[Cache] Hit: ${cacheKey}, ${cached.value[0]?.targetbranch}`)
    return cached.value satisfies Readonly<MergeRequest[]>
  }

  const fresh = (yield* fetchMergeRequestsEffect(key)) satisfies Readonly<MergeRequest[]>

  yield* schemaStore.set(cacheKey, fresh);

  return fresh
})

export const mrsByUserAtomFamily = Atom.family((key: MRCacheKey) => {
  console.log("[mrsByUserAtomFamily] Creating atom for key:", toCacheKeyString(key));
  return cacheRuntime.atom(fetchUserMRsWithCache(key)).pipe(
    Atom.setLazy(false),
    Atom.keepAlive
  )
})

const toProjectCacheKeyString = (key: ProjectMRCacheKey): string => {
  const fixedProject = key.projectPath
    .replace(/:/g, '_')
    .replace(/\//g, '_')
  return `mrs_${key.state}_${fixedProject}_gitlab`
}

const fetchProjectMRsWithCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(Schema.Array(MergeRequestSchema))

  const cached = yield* schemaStore.get(cacheKey);
  if (cached._tag === "Some") {
    console.log(`[Cache] Hit: ${cacheKey}`)
    return cached.value
  }

  console.log(`[Cache] Miss: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProjectEffect(key)

  yield* schemaStore.set(cacheKey, fresh)

  return fresh
})

export const mrsByProjectAtomFamily = Atom.family((key: ProjectMRCacheKey) => {
  return cacheRuntime.atom(fetchProjectMRsWithCache(key)).pipe(
    Atom.setLazy(false),
    Atom.keepAlive
  )
})

export const invalidateUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(Schema.Array(MergeRequestSchema))
  yield* schemaStore.remove(cacheKey)
  console.log(`[Cache] Invalidated: ${cacheKey}`)
})

export const invalidateProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(Schema.Array(MergeRequestSchema))
  yield* schemaStore.remove(cacheKey)
  console.log(`[Cache] Invalidated: ${cacheKey}`)
})