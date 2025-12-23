import { Atom, Result } from "@effect-atom/atom-react";
import { Effect, Stream } from "effect";
import { EventStorage } from "../events/events";
import { appAtomRuntime } from "../appLayerRuntime";
import { fetchActiveSprints, loadSprintTreeAsEvent } from "./jira-sprint-service";
import {
  projectSprints,
  initialSprintsState,
  projectSelection,
  initialSelectionState,
  projectSprintTree,
  initialSprintTreeState,
  type SprintsState,
  type SelectionState,
  type SprintTreeState
} from "./jira-sprint-projections";

// =============================================================================
// Projected Atoms
// =============================================================================

// Helper to create an atom from the event stream with a projection
const makeProjectedAtom = <S>(initial: S, project: (s: S, e: any) => S) => {
  return appAtomRuntime.atom(
    Stream.unwrap(EventStorage.combinedEventsStream).pipe(
      Stream.scan(initial, project)
    ),
    { initialValue: initial }
  );
};

// Sprints List
export const sprintsStateAtom = makeProjectedAtom(initialSprintsState, projectSprints);

export const sprintsAtom = Atom.map(sprintsStateAtom, (result) =>
  Result.getOrElse(result, () => initialSprintsState).sprints
);

export const boardIdAtom = Atom.map(sprintsStateAtom, (result) =>
  Result.getOrElse(result, () => initialSprintsState).boardId
);

// Selection
export const selectionStateAtom = makeProjectedAtom(initialSelectionState, projectSelection);

export const selectedSprintIdAtom = Atom.map(selectionStateAtom, (result) =>
  Result.getOrElse(result, () => initialSelectionState).selectedSprintId
);

export const selectedSprintAtom = Atom.readable((get) => {
  const sprints = get(sprintsAtom);
  const selectedId = get(selectedSprintIdAtom);
  return sprints.find((s) => s.id === selectedId) ?? null;
});

// Sprint Tree
export const sprintTreeStateAtom = makeProjectedAtom(initialSprintTreeState, projectSprintTree);

export const sprintTreeAtom = Atom.map(sprintTreeStateAtom, (result) =>
  Result.getOrElse(result, () => initialSprintTreeState).tree
);

// =============================================================================
// UI State Atoms
// =============================================================================
export const selectedIssueIndexAtom = Atom.make<number>(0);
export const expandedKeysAtom = Atom.make<Set<string>>(new Set<string>());

// =============================================================================
// Action Atoms (Appenders)
// =============================================================================

// Load sprints for a board
export const loadSprintsAtom = appAtomRuntime.fn((boardId: number) =>
  Effect.gen(function* () {
    const sprints = yield* fetchActiveSprints(boardId);
    yield* EventStorage.appendInMemoryEvent({
      type: "jira-sprints-loaded-event",
      boardId,
      sprints,
      timestamp: new Date().toISOString(),
    });
  })
);

// Load issues for a specific sprint
export const loadSprintIssuesAtom = appAtomRuntime.fn((args: { sprintId: number; boardId: number }) =>
  Effect.gen(function* () {
    const { tree: _, event } = yield* loadSprintTreeAsEvent(
      args.sprintId,
      args.boardId
    );

    if (event) {
      yield* EventStorage.appendEvent(event);
    }
  })
);

// Select a sprint
export const selectSprintAtom = appAtomRuntime.fn((args: { sprintId: number; boardId: number }) =>
  Effect.gen(function* () {
    yield* EventStorage.appendInMemoryEvent({
      type: "jira-sprint-selected-event",
      sprintId: args.sprintId,
      boardId: args.boardId,
      timestamp: new Date().toISOString(),
    });
  })
);

// =============================================================================
// Writable UI Atoms
// =============================================================================
export const toggleExpandAtom = Atom.writable(
  (get) => get(expandedKeysAtom),
  (ctx, key: string) => {
    const prev = ctx.get(expandedKeysAtom);
    const newExpanded = new Set<string>(prev);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    ctx.set(expandedKeysAtom, newExpanded);
  }
);

export type FlatListItem = {
  type: "parent" | "child";
  key: string;
  issue: any;
  level: number;
};

export const flattenedListAtom = Atom.readable((get) => {
  const tree = get(sprintTreeAtom);
  const expandedKeys = get(expandedKeysAtom);
  const items: FlatListItem[] = [];

  tree.forEach((node) => {
    items.push({
      type: "parent",
      key: node.issue.key,
      issue: node.issue,
      level: 0,
    });

    if (expandedKeys.has(node.issue.key)) {
      node.children.forEach((child) => {
        items.push({
          type: "child",
          key: child.key,
          issue: child,
          level: 1,
        });
      });
    }
  });

  return items;
});
