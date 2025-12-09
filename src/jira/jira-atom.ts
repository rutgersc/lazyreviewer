import { Atom } from "@effect-atom/atom-react";

export const selectedJiraIndexAtom = Atom.make<number>(0);
export const selectedJiraSubIndexAtom = Atom.make<number>(0);
export const jiraCommentFocusedAtom = Atom.make<boolean>(false);
export const selectedJiraCommentIndexAtom = Atom.make<number>(0);
