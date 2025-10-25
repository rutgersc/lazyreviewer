import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { Effect } from "effect";
import { extractSelectionData, useAppStore } from "./appStore";
import { mrsByUserAtomFamily, mrsByProjectAtomFamily, MRCacheKey, ProjectMRCacheKey } from "./mrCacheAtoms";
import type { MergeRequestState } from "../generated/gitlab-sdk";

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
            onSuccess: (success) => (success.value as MergeRequest[])[selectedMrIndex],
            onFailure: (failure) => undefined
        });
    }

    return undefined;
})

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(initialState.userSelections);

export const selectedUserSelectionEntryAtom = Atom.make<number>(initialState.selectedUserSelectionEntry);

export const expandedSelectedUserSelectionAtom = Atom.make(get => {
    const selectedUserSelectionEntry = get(selectedUserSelectionEntryAtom);
    const userSelections = get(userSelectionsAtom);

    const { usernames, repositories } = extractSelectionData(
        selectedUserSelectionEntry,
        userSelections,
        groups
    );
    return { usernames, repositories };
});

export const selectedUserSelectionAtom = Atom.make(get =>  {
    const userSelections = get(userSelectionsAtom);
    const index = get(selectedUserSelectionEntryAtom);
    return userSelections[index];
})

export const mergeRequestsAtom = Atom.make((get) => {
    const selectionEntry = get(selectedUserSelectionAtom);
    if (!selectionEntry) {
        return Effect.succeed([]);
    }

    const filterMrState = get(filterMrStateAtom);
    const { repositories, usernames } = get(expandedSelectedUserSelectionAtom);

    if (repositories.length > 0 && repositories[0]) {
        const cacheKey = new ProjectMRCacheKey({
            selectionEntry: selectionEntry.name,
            projectPath: repositories[0],
            state: filterMrState
        });
        return get(mrsByProjectAtomFamily(cacheKey));
    } else if (usernames.length > 0) {
        const cacheKey = new MRCacheKey({
            selectionEntry: selectionEntry.name,
            usernames,
            state: filterMrState
        });
        return get(mrsByUserAtomFamily(cacheKey));
    } else {
        return Effect.succeed([]);
    }
})

