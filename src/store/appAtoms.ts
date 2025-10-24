import { Atom, Registry, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../components/MergeRequestPane";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { groups, mockUserSelections } from "../data/usersAndGroups";
import { Effect } from "effect";
import { extractSelectionData } from "./appStore";
import { fetchMergeRequests, fetchMergeRequestsByProject } from "../mergerequests/mergerequests-effects";
import type { MergeRequestState } from "../generated/gitlab-sdk";


export const filterMrStateAtom = Atom.make<MergeRequestState>("opened");

// export const mergeRequestsAtom = Atom.make<MergeRequest[]>([]);
export const selectedMrIndexAtom = Atom.make<number>(0);
export const selectedMrAtom = Atom.make(get =>  {
    const selectedMrIndex = get(selectedMrIndexAtom);
    const mergeRequests = get(mergeRequestsAtom);

    const res = Result.match(mergeRequests, {
        onInitial: () => undefined,
        onSuccess: (success) => success.value[selectedMrIndex],
        onFailure: (failure) => undefined
    });

    return res;
})


export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(mockUserSelections);
export const selectedUserSelectionEntryAtom = Atom.make<number>(0);
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

const mergeRequestsAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const selectionEntry = get(selectedUserSelectionAtom);
    if (!selectionEntry) {
        return [];
    }

    const filterMrState = get(filterMrStateAtom);
    const { repositories, usernames } = get(expandedSelectedUserSelectionAtom);

    if (repositories.length > 0 && repositories[0]) {
        const repo = repositories[0];
        const mrs = yield* Effect.tryPromise(
            () => fetchMergeRequestsByProject(selectionEntry.name, repo, filterMrState));
        return mrs;

    } else if (usernames.length > 0) {
        const mrs = yield* Effect.tryPromise(
            () => fetchMergeRequests(selectionEntry.name, usernames, filterMrState));

        return mrs;
    } else {
        return [];
    }
  })
)

