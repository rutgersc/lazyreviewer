import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { Effect } from "effect";
import { extractSelectionData, useAppStore } from "./appStore";
import { mrsByUserAtomFamily, mrsByProjectAtomFamily, MRCacheKey, ProjectMRCacheKey, type CacheKey } from "./mrCacheAtoms";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import type { PlatformError } from "@effect/platform/Error";
import type { ParseError } from "effect/ParseResult";
import { fetchMergeRequestsEffect } from "../mergerequests/mergerequests-effects";

// Writable atoms - start with values from Zustand store
const initialState = useAppStore.getState();

export const filterMrStateAtom = Atom.make<MergeRequestState>(initialState.mrState);

export const selectedMrIndexAtom = Atom.make<number>(initialState.selectedMergeRequest);

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

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(initialState.userSelections);
export const selectedUserSelectionEntryAtom = Atom.make<number>(initialState.selectedUserSelectionEntry);

export const mergeRequestsKeyAtom = Atom.make((get): CacheKey | undefined  => {
    const userSelections = get(userSelectionsAtom);
    const userSelectionIndex = get(selectedUserSelectionEntryAtom);
    const selectionEntry = userSelections[userSelectionIndex];
    const filterMrState = get(filterMrStateAtom);

    return extractSelectionData(selectionEntry, groups, filterMrState);
})

export const mergeRequestsAtom = Atom.make((get): Result.Result<readonly MergeRequest[], PlatformError | ParseError | Error>  => {
    const cacheKey = get(mergeRequestsKeyAtom);
    if (!cacheKey) {
        return Result.success([]);
    }

    switch (cacheKey._tag) {
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

