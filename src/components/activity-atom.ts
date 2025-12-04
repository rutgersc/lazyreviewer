import { Atom } from "@effect-atom/atom-react";

export const selectedActivityIndexAtom = Atom.make<number>(0);

// When set, ActivityLog will find and select the event matching this note ID
export const targetNoteIdAtom = Atom.make<string | null>(null);
