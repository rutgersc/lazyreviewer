import { Atom } from "@effect-atom/atom-react";
import { parseKeyString } from "../actions/key-matcher";
import { userSelectionsAtom } from "../userselection/userselection-atom";
import { selectedUserSelectionEntryIdAtom } from "../settings/settings-atom";
import { highlightIndexAtom, scrollToItemRequestAtom } from "./UserSelectionPane";

export const userSelectionActionsAtom = Atom.make((get) => {
  const userSelections = get(userSelectionsAtom);
  const registry = get.registry;

  if (userSelections.length === 0) return [];

  return [
    {
      id: 'userselection:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate user selections',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const userSelections = registry.get(userSelectionsAtom);
        const newIndex = Math.min(highlightIndex + 1, userSelections.length - 1);
        registry.set(highlightIndexAtom, newIndex);
        registry.set(scrollToItemRequestAtom, newIndex);
      },
    },
    {
      id: 'userselection:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const newIndex = Math.max(highlightIndex - 1, 0);
        registry.set(highlightIndexAtom, newIndex);
        registry.set(scrollToItemRequestAtom, newIndex);
      },
    },
    {
      id: 'userselection:select',
      keys: [parseKeyString('space')],
      displayKey: 'Space',
      description: 'Select user/group',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const userSelections = registry.get(userSelectionsAtom);
        const entry = userSelections[highlightIndex];
        if (entry) {
          registry.set(selectedUserSelectionEntryIdAtom, entry.userSelectionEntryId);
        }
      },
    },
    {
      id: 'userselection:reset',
      keys: [parseKeyString('escape')],
      displayKey: 'Esc',
      description: 'Reset highlight',
      handler: () => {
        registry.set(highlightIndexAtom, 0);
      },
    },
  ];
});
