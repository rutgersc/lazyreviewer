import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { Effect } from "effect";
import { extractSelectionData, useAppStore } from "./appStore";
import { mrsByUserAtomFamily, mrsByProjectAtomFamily, MRCacheKey, ProjectMRCacheKey } from "./mrCacheAtoms";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import type { PlatformError } from "@effect/platform/Error";
import type { ParseError } from "effect/ParseResult";

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

export const mergeRequestsKeyAtom = Atom.make((get): MRCacheKey | ProjectMRCacheKey | undefined  => {
    const userSelections = get(userSelectionsAtom);
    const userSelectionIndex = get(selectedUserSelectionEntryAtom);
    const selectionEntry = userSelections[userSelectionIndex];
    if (!selectionEntry) {
        return;
    }

    const { usernames, repositories } = extractSelectionData(
        userSelectionIndex,
        userSelections,
        groups
    );

    const filterMrState = get(filterMrStateAtom);

    if (repositories.length > 0 && repositories[0]) {
        const cacheKey = new ProjectMRCacheKey({
            selectionEntry: selectionEntry.name,
            projectPath: repositories[0],
            state: filterMrState
        });
        return cacheKey;
    } else if (usernames.length > 0) {
        const cacheKey = new MRCacheKey({
            selectionEntry: selectionEntry.name,
            usernames,
            state: filterMrState
        });
        return cacheKey;
    }
})

export const mergeRequestsAtom = Atom.make((get): Result.Result<readonly MergeRequest[], PlatformError | ParseError | Error>  => {
    const cacheKey = get(mergeRequestsKeyAtom);
    console.log("MR atom")

    if (cacheKey instanceof ProjectMRCacheKey) {
        const v = mrsByProjectAtomFamily(cacheKey);
        return get(v);
    }
    else if (cacheKey instanceof MRCacheKey) {
        return get(mrsByUserAtomFamily(cacheKey));
    }

    return Result.success([]);
})

export const unwrappedMergeRequestsAtom = Atom.map(
    mergeRequestsAtom,
    (result): readonly MergeRequest[] => Result.match(result, {
        onInitial: () => [],
        onFailure: (cause) => {
            console.error('[MergeRequestPane] Failed to load MRs:', cause);
            return [];
        },
        onSuccess: (mrs) =>  {
            console.log("success mergerequests things");
            return mrs.value;
        }
    })
)

