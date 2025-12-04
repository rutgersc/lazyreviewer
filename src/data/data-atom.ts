import { Atom } from "@effect-atom/atom-react";
import { groups, users } from "./usersAndGroups";

export const groupsAtom = Atom.make(groups);
export const usersAtom = Atom.make(users);
