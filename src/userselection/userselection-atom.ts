import { Atom } from "@effect-atom/atom-react";
import type { UserSelectionEntry } from "./userSelection";
import { mockUserSelections } from "../data/usersAndGroups";
import { selectedUserSelectionEntryIdAtom } from "../settings/settings-atom";

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(mockUserSelections);

export const userSelectionsByIdAtom = Atom.map(
  userSelectionsAtom,
  (selections) => new Map(selections.map((s) => [s.userSelectionEntryId, s]))
);

export const selectedUserSelectionEntryAtom = Atom.make((get) => {
  const selectedId = get(selectedUserSelectionEntryIdAtom);
  const byId = get(userSelectionsByIdAtom);
  return selectedId ? byId.get(selectedId) : undefined;
});

// Highlight index for keyboard navigation (separate from committed selection)
export const userSelectionHighlightIndexAtom = Atom.make<number>(0);

