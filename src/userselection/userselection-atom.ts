import { Atom } from "@effect-atom/atom-react";
import { groupToUserSelectionEntry } from "./userSelection";
import { userGroupsAtom } from "../settings/settings-atom";

export const userSelectionsAtom = Atom.make(get =>
  get(userGroupsAtom).map(groupToUserSelectionEntry)
);

export const userSelectionsByIdAtom = Atom.map(
  userSelectionsAtom,
  (selections) => new Map(selections.map((s) => [s.userSelectionEntryId, s]))
);
