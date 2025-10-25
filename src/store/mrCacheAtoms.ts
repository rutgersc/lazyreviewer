import { Atom } from "@effect-atom/atom"
import { Effect, Duration, Data, Layer, Schema } from "effect"
import { MergeRequestSchema, type MergeRequest } from "../schemas/mergeRequestSchema"
import { fetchMergeRequests, fetchMergeRequestsByProject, fetchMergeRequestsByProjectEffect, fetchMergeRequestsEffect } from "../mergerequests/mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import * as Path from "@effect/platform-node/NodePath"

export class MRCacheKey extends Data.Class<{
  selectionEntry: string
  usernames: readonly string[]
  state: MergeRequestState
}> {
  toCacheKey(): string {
    const fixedEntry = this.selectionEntry
      .replace(/:/g, '_')
      .replace(/\//g, '_')
      .replace(/ /g, '-')
    return `mrs_${this.state}_${fixedEntry}_gitlab`
  }
}

export class ProjectMRCacheKey extends Data.Class<{
  selectionEntry: string
  projectPath: string
  state: MergeRequestState
}> {
  toCacheKey(): string {
    const fixedEntry = this.selectionEntry
      .replace(/:/g, '_')
      .replace(/\//g, '_')
      .replace(/ /g, '-')
    const fixedProject = this.projectPath
      .replace(/:/g, '_')
      .replace(/\//g, '_')
    return `mrs_${this.state}_${fixedEntry}_${fixedProject}_gitlab`
  }
}

// Create the cache runtime with KeyValueStore layer
const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer)
)
const cacheRuntime = Atom.runtime(cacheLayer)


const fetchWithCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = key.toCacheKey()
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
  console.log("[mrsByUserAtomFamily] Creating atom for key:", key.toCacheKey());
  return cacheRuntime.atom(fetchWithCache(key)).pipe(
    Atom.setLazy(false),
    Atom.keepAlive
  )
})

export const mrsByProjectAtomFamily = Atom.family((key: ProjectMRCacheKey) => {
  const cacheKey = key.toCacheKey()
  const schema = Schema.Array(MergeRequestSchema)
  const fetch = fetchMergeRequestsByProjectEffect(key)
  const ttl = Duration.seconds(60)

  const fetchWithCache = Effect.gen(function* () {
    const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(schema)


    const cached = yield* schemaStore.get(cacheKey);
    if (cached._tag === "Some") {
      console.log(`[Cache] Hit: ${cacheKey}`)
      return cached.value
    }

    console.log(`[Cache] Miss: ${cacheKey}`)
    const fresh = yield* fetch

    yield* schemaStore.set(cacheKey, fresh)

    return fresh
  })

  return cacheRuntime.atom(fetchWithCache).pipe(
    Atom.setLazy(false),
    Atom.keepAlive // Keep atoms alive to ensure cache writes complete
  )
})