import { Atom } from "@effect-atom/atom-react";
import { Effect } from "effect";
import type { JiraSprint, JiraSprintTree } from "./jira-sprint-schema";
import { loadActiveSprintTree } from "./jira-sprint-service";

export type JiraSprintBoardState = {
  isLoading: boolean;
  error: string | null;
  sprint: JiraSprint | null;
  tree: JiraSprintTree;
  selectedIndex: number;
  expandedKeys: Set<string>;
};

const initialState: JiraSprintBoardState = {
  isLoading: false,
  error: null,
  sprint: null,
  tree: [],
  selectedIndex: 0,
  expandedKeys: new Set(),
};

export const jiraSprintBoardAtom = Atom.make<JiraSprintBoardState>(initialState);

export const loadSprintBoardAtom = Atom.writable(
  (get) => get(jiraSprintBoardAtom),
  (ctx, boardId: number) => {
    const prev = ctx.get(jiraSprintBoardAtom);
    ctx.set(jiraSprintBoardAtom, {
      ...prev,
      isLoading: true,
      error: null,
    });

    Effect.runPromise(loadActiveSprintTree(boardId))
      .then(({ sprint, tree }) => {
        const expandedKeys = new Set(tree.map(node => node.issue.key));
        ctx.set(jiraSprintBoardAtom, {
          isLoading: false,
          error: null,
          sprint,
          tree,
          selectedIndex: 0,
          expandedKeys,
        });
      })
      .catch(error => {
        const current = ctx.get(jiraSprintBoardAtom);
        ctx.set(jiraSprintBoardAtom, {
          ...current,
          isLoading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
);

export const toggleExpandAtom = Atom.writable(
  (get) => get(jiraSprintBoardAtom).expandedKeys,
  (ctx, key: string) => {
    const prev = ctx.get(jiraSprintBoardAtom);
    const newExpanded = new Set(prev.expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    ctx.set(jiraSprintBoardAtom, { ...prev, expandedKeys: newExpanded });
  }
);

export const setSelectedIndexAtom = Atom.writable(
  (get) => get(jiraSprintBoardAtom).selectedIndex,
  (ctx, index: number) => {
    const prev = ctx.get(jiraSprintBoardAtom);
    ctx.set(jiraSprintBoardAtom, { ...prev, selectedIndex: index });
  }
);

export type FlatListItem = {
  type: 'parent' | 'child';
  key: string;
  parentKey: string | null;
  issue: JiraSprintTree[0]['issue'] | JiraSprintTree[0]['children'][0];
  childIndex?: number;
  isLastChild?: boolean;
};

export const flattenedListAtom = Atom.readable((get) => {
  const { tree, expandedKeys } = get(jiraSprintBoardAtom);
  const items: FlatListItem[] = [];

  tree.forEach((node) => {
    items.push({
      type: 'parent',
      key: node.issue.key,
      parentKey: null,
      issue: node.issue,
    });

    if (expandedKeys.has(node.issue.key)) {
      node.children.forEach((child, idx) => {
        items.push({
          type: 'child',
          key: child.key,
          parentKey: node.issue.key,
          issue: child,
          childIndex: idx,
          isLastChild: idx === node.children.length - 1,
        });
      });
    }
  });

  return items;
});
