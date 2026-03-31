import { Atom } from "effect/unstable/reactivity";
import { selectedMrAtom } from "../mergerequests/mergerequests-atom";

export const overviewCursorIndexAtom = Atom.make<number>(0);
export const unresolvedExpandedAtom = Atom.make<boolean>(true);
export const resolvedExpandedAtom = Atom.make<boolean>(false);
export const scrollToDiscussionRequestAtom = Atom.make<string | null>(null);

export const overviewSelectableItemsAtom = Atom.make((get) => {
  const selectedMr = get(selectedMrAtom);
  const discussions = selectedMr?.discussions ?? [];
  const unresolvedCount = discussions.filter(d => d.resolvable && !d.resolved).length;
  const resolvedCount = discussions.filter(d => d.resolvable && d.resolved).length;
  return buildSelectableItems(unresolvedCount, resolvedCount, get(unresolvedExpandedAtom), get(resolvedExpandedAtom));
});

export const currentSelectionAtom = Atom.make((get) => {
  const items = get(overviewSelectableItemsAtom);
  const cursor = get(overviewCursorIndexAtom);
  return items[Math.min(cursor, Math.max(0, items.length - 1))];
});

export type SelectableItem =
  | { type: 'unresolved-header' }
  | { type: 'unresolved-discussion'; index: number }
  | { type: 'resolved-header' }
  | { type: 'resolved-discussion'; index: number }

export function buildSelectableItems(
  unresolvedCount: number,
  resolvedCount: number,
  unresolvedExpanded: boolean,
  resolvedExpanded: boolean
): SelectableItem[] {
  const items: SelectableItem[] = [];

  if (unresolvedCount > 0) {
    items.push({ type: 'unresolved-header' });
    if (unresolvedExpanded) {
      for (let i = 0; i < unresolvedCount; i++) {
        items.push({ type: 'unresolved-discussion', index: i });
      }
    }
  }

  if (resolvedCount > 0) {
    items.push({ type: 'resolved-header' });
    if (resolvedExpanded) {
      for (let i = 0; i < resolvedCount; i++) {
        items.push({ type: 'resolved-discussion', index: i });
      }
    }
  }

  return items;
}

export function itemsEqual(a: SelectableItem, b: SelectableItem): boolean {
  if (a.type !== b.type) return false;
  if ('index' in a && 'index' in b) return a.index === b.index;
  return true;
}

export function findCursorForItem(items: SelectableItem[], target: SelectableItem): number {
  return items.findIndex(item => itemsEqual(item, target));
}

export function getScrollId(item: SelectableItem): string {
  switch (item.type) {
    case 'unresolved-header': return 'unresolved-header';
    case 'unresolved-discussion': return `discussion-${item.index}`;
    case 'resolved-header': return 'resolved-header';
    case 'resolved-discussion': return `resolved-discussion-${item.index}`;
  }
}
