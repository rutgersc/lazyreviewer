import { Atom } from "@effect-atom/atom-react";

export const lastTargetBranchAtom = Atom.make<string | null>(null);
