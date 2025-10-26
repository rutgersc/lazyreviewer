import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { Effect, Layer } from "effect";
import { extractSelectionData } from "./appStore";
import { mrsByUserAtomFamily, mrsByProjectAtomFamily, MRCacheKey, ProjectMRCacheKey, type CacheKey, invalidateUserMRsCache, invalidateProjectMRsCache } from "./mrCacheAtoms";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import type { PlatformError } from "@effect/platform/Error";
import type { ParseError } from "effect/ParseResult";
import { KeyValueStore, Path } from "@effect/platform";
import * as FileSystem from "@effect/platform-node/NodeFileSystem"




export const selectedMrIndexAtom = Atom.make<number>(0);

export const selectedMrAtom = Atom.make(get =>  {
    const selectedMrIndex = get(selectedMrIndexAtom);
    const mergeRequestsResult = get(mergeRequestsAtom);

    if (Result.isResult(mergeRequestsResult)) {
        return Result.match(mergeRequestsResult, {
            onInitial: () => undefined,
            onSuccess: (success) => success.value[selectedMrIndex],
            onFailure: (failure) => undefined
        });
    }

    return undefined;
})

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(mockUserSelections);
export const selectedUserSelectionEntryAtom = Atom.make<number>(0);

export const filterMrStateAtom = Atom.make<MergeRequestState>('opened');

export const mergeRequestsKeyAtom = Atom.make((get): CacheKey | undefined  => {
    const userSelections = get(userSelectionsAtom);
    const userSelectionIndex = get(selectedUserSelectionEntryAtom);
    const selectionEntry = userSelections[userSelectionIndex];
    const filterMrState = get(filterMrStateAtom);

    return extractSelectionData(selectionEntry, groups, filterMrState);
})

export const mergeRequestsAtom = Atom.make((get): Result.Result<readonly MergeRequest[], PlatformError | ParseError | Error>  => {
    const cacheKey = get(mergeRequestsKeyAtom);
    switch (cacheKey?._tag) {
        case undefined:
            return Result.success([]);
        case "ProjectMRs":
            return get(mrsByProjectAtomFamily(cacheKey));
        case "UserMRs":
            return get(mrsByUserAtomFamily(cacheKey));
    }
})

export const unwrappedMergeRequestsAtom = Atom.map(
    mergeRequestsAtom,
    (result): readonly MergeRequest[] => {
        return Result.match(result, {
            onInitial: () => [],
            onFailure: () => [],
            onSuccess: (mrs) =>  mrs.value
        })
    }
)


const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer)
)
export const cacheRuntime = Atom.runtime(cacheLayer)

export const forceRefreshMergeRequests = (registry: Registry.Registry, cacheKey: CacheKey | undefined) => {
  if (!cacheKey) return

  const invalidateAndRefresh = (invalidateEffect: Effect.Effect<void, PlatformError, KeyValueStore.KeyValueStore>, atom: Atom.Atom<any>) => {
    const runtimeResult = registry.get(cacheRuntime)
    if (!Result.isSuccess(runtimeResult)) return

    const runtime = runtimeResult.value
    Effect.runPromise(Effect.provide(invalidateEffect, runtime.context)).then(() => {
      registry.refresh(atom)
    }).catch(err => {
      console.error('[Cache] Failed to invalidate:', err)
    })
  }

  switch (cacheKey._tag) {
    case "ProjectMRs":
      invalidateAndRefresh(invalidateProjectMRsCache(cacheKey), mrsByProjectAtomFamily(cacheKey))
      break
    case "UserMRs":
      invalidateAndRefresh(invalidateUserMRsCache(cacheKey), mrsByUserAtomFamily(cacheKey))
      break
  }
}

