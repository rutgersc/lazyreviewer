import { Atom } from "@effect-atom/atom"
import { Effect, Duration, Data } from "effect"
import * as Schema from "@effect/schema/Schema"
import { cachedAtom } from "../cache/cachedAtom"
import { MergeRequestSchema } from "../schemas/mergeRequestSchema"
import { fetchMergeRequests, fetchMergeRequestsByProject } from "../mergerequests/mergerequests-effects"
import type { MergeRequestState } from "../generated/gitlab-sdk"

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

export const mrsByUserAtomFamily = Atom.family((key: MRCacheKey) => {
  const fetchEffect = Effect.tryPromise(() =>
    fetchMergeRequests(key.selectionEntry, key.usernames as string[], key.state)
  )

  return cachedAtom(
    key.toCacheKey(),
    Schema.Array(MergeRequestSchema),
    fetchEffect,
    Duration.seconds(60)
  )
})

export const mrsByProjectAtomFamily = Atom.family((key: ProjectMRCacheKey) => {
  const fetchEffect = Effect.tryPromise(() =>
    fetchMergeRequestsByProject(key.selectionEntry, key.projectPath, key.state)
  )

  return cachedAtom(
    key.toCacheKey(),
    Schema.Array(MergeRequestSchema),
    fetchEffect,
    Duration.seconds(60)
  )
})
