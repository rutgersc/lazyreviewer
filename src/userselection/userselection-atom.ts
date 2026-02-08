import { Atom } from "@effect-atom/atom-react";
import type { UserSelectionEntry } from "./userSelection";
import { mockUserSelections } from "../data/usersAndGroups";

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(mockUserSelections);

export const userSelectionsByIdAtom = Atom.map(
  userSelectionsAtom,
  (selections) => new Map(selections.map((s) => [s.userSelectionEntryId, s]))
);
