import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { extractSelectionData } from "./appStore";
import { mrsByUserAtomFamily, mrsByProjectAtomFamily, MRCacheKey, ProjectMRCacheKey, type CacheKey, invalidateUserMRsCache, invalidateProjectMRsCache, atomRuntime } from "./mrCacheAtoms";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import type { PlatformError } from "@effect/platform/Error";
import type { ParseError } from "effect/ParseResult";
import { Console, Effect, Layer } from "effect";

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

export const mergeRequestsAtom = Atom.make((get): Result.Result<readonly MergeRequest[], unknown>  => {
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

export const refreshMergeRequestsAtom = atomRuntime.fn((cacheKey: CacheKey | undefined, atomContext) =>
  Effect.gen(function* () {
    if (!cacheKey) return

    switch (cacheKey._tag) {
      case "ProjectMRs":
        yield* invalidateProjectMRsCache(cacheKey)
        break
      case "UserMRs":
        yield* invalidateUserMRsCache(cacheKey)
        break
    }

    atomContext.refresh(mergeRequestsKeyAtom)
  })
)

