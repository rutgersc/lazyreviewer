import { Atom, Registry } from "@effect-atom/atom"
import { Effect, Data, Schema, Layer, Console, DefaultServices } from "effect"
import { MergeRequestSchema, type MergeRequest } from "../schemas/mergeRequestSchema"
import { fetchMergeRequestsByProjectEffect, fetchMergeRequestsEffect } from "../mergerequests/mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"
import { KeyValueStore, Path } from "@effect/platform";
import * as FileSystem from "@effect/platform-node/NodeFileSystem"


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

export class MergeRequestStorage extends Effect.Service<MergeRequestStorage>()("MergeRequestStorage", {
  effect: Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const schemaStore = store.forSchema(Schema.Array(MergeRequestSchema))

    return {
      get: (key: string) => schemaStore.get(key),
      set: (key: string, value: readonly MergeRequest[]) => schemaStore.set(key, value),
      invalidate: (key: string) => schemaStore.remove(key)
    } as const
  })
}) {}

export const MergeRequestStorageLogged = Layer.effect(
  MergeRequestStorage,
  Effect.gen(function* () {
    const storage = yield* MergeRequestStorage
    const console = yield* Console.Console

    const get = (key: string) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] get: ${key}`);
        return yield* storage.get(key);
      });

    const set = (key: string, value: readonly MergeRequest[]) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] set: ${key}`);
        return yield* storage.set(key, value);
      });

    const invalidate = (key: string) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] invalidate: ${key}`);
        return yield* storage.invalidate(key);
      });

    return new MergeRequestStorage({
      get: get,
      set: set,
      invalidate: invalidate,
    })
  })
)

const fetchUserMRsWithCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    console.log(`[Cache] Hit: ${cacheKey}, ${cached.value[0]?.targetbranch}`)
    return cached.value satisfies Readonly<MergeRequest[]>
  }

  const fresh = (yield* fetchMergeRequestsEffect(key)) satisfies Readonly<MergeRequest[]>

  yield* storage.set(cacheKey, fresh);

  return fresh
})

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer),
)

const mergeRequestStorageLayer = MergeRequestStorage.Default.pipe(
  Layer.provide(cacheLayer)
)

const mergeRequestWithLoggingLayer = MergeRequestStorageLogged.pipe(
  Layer.provide(mergeRequestStorageLayer),
  Layer.provide(Layer.succeedContext(DefaultServices.liveServices))
)

// Do not rely on Regsitry.layer: this is likely internal to atom-effect
export const appLayer = mergeRequestWithLoggingLayer

export const atomRuntime = Atom.runtime(appLayer)

export const mrsByUserAtomFamily = Atom.family((key: MRCacheKey) => {
  console.log("[mrsByUserAtomFamily] Creating atom for key:", toCacheKeyString(key));
  return atomRuntime.atom(fetchUserMRsWithCache(key)).pipe(
    Atom.setLazy(false),
    Atom.keepAlive
  )
})

const fetchProjectMRsWithCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    console.log(`[Cache] Hit: ${cacheKey}`)
    return cached.value
  }

  console.log(`[Cache] Miss: ${cacheKey}`)
  const fresh = yield* fetchMergeRequestsByProjectEffect(key)

  yield* storage.set(cacheKey, fresh)

  return fresh
})

export const mrsByProjectAtomFamily = Atom.family((key: ProjectMRCacheKey) => {
  const atom = atomRuntime.atom(fetchProjectMRsWithCache(key));
  return atom.pipe(
    Atom.setLazy(false),
    Atom.keepAlive
  )
})

export const invalidateUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  console.log(`[Cache] Invalidated: ${cacheKey}`)
})

export const invalidateProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  console.log(`[Cache] Invalidated: ${cacheKey}`)
})