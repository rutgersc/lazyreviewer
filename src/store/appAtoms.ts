import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { ActivePane } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { extractSelectionData, type ActiveModal, type InfoPaneTab } from "./appStore";
import { type CacheKey, forceRefreshUserMRsCache, forceRefreshProjectMRsCache, MRCacheKey, fetchUserMRsWithCache, ProjectMRCacheKey, fetchProjectMRsWithCache } from "../mergerequests/mergerequests-caching-effects";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import { Effect } from "effect";
import { appAtomRuntime } from "./appLayerRuntime";

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

// Phase 1: UI Navigation State
export const activePaneAtom = Atom.make<ActivePane>(ActivePane.MergeRequests);
export const activeModalAtom = Atom.make<ActiveModal>('none');
export const infoPaneTabAtom = Atom.make<InfoPaneTab>('overview');

export const mergeRequestsKeyAtom = Atom.make((get): CacheKey | undefined  => {
    const userSelections = get(userSelectionsAtom);
    const userSelectionIndex = get(selectedUserSelectionEntryAtom);
    const selectionEntry = userSelections[userSelectionIndex];
    const filterMrState = get(filterMrStateAtom);

    return extractSelectionData(selectionEntry, groups, filterMrState);
})

const mrsByUserAtomFamily = Atom.family((key: MRCacheKey) => {
    const atom = appAtomRuntime.atom(fetchUserMRsWithCache(key));
    return atom.pipe(Atom.setLazy(false), Atom.keepAlive);
});

const mrsByProjectAtomFamily = Atom.family((key: ProjectMRCacheKey) => {
    const atom = appAtomRuntime.atom(fetchProjectMRsWithCache(key));
    return atom.pipe(Atom.setLazy(false), Atom.keepAlive);
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

export const refreshMergeRequestsAtom = appAtomRuntime.fn((cacheKey: CacheKey | undefined, atomContext) =>
  Effect.gen(function* () {
    if (!cacheKey) return

    // Force refresh fetches new data and updates cache WITHOUT clearing it first
    // This keeps old data visible while new data loads
    switch (cacheKey._tag) {
      case "ProjectMRs":
        yield* forceRefreshProjectMRsCache(cacheKey)
        break
      case "UserMRs":
        yield* forceRefreshUserMRsCache(cacheKey)
        break
    }

    // Refresh the atom to read the newly updated cache
    atomContext.refresh(mergeRequestsKeyAtom)
  })
)




