import { Atom, Result } from "@effect-atom/atom-react";
import { Effect, Stream } from "effect";
import { EventStorage, type AnyLazyReviewerEvent } from "../events/events";
import { appAtomRuntime } from "../appLayerRuntime";
import { fetchActiveSprints, loadSprintTreeAsEvent } from "./jira-sprint-service";
import {
  sprintsProjection,
  selectionProjection,
  sprintIssuesProjection,
} from "./jira-sprint-projections";
import { project, type Projection } from "../utils/define-projection";
import { buildSprintTree } from "./jira-sprint-service";

// =============================================================================
// Projected Atoms
// =============================================================================

// Helper that takes a Projection - automatically filters and projects
const makeProjectedAtomFromProjection = <S, E extends AnyLazyReviewerEvent>(
  stream: Effect.Effect<Stream.Stream<AnyLazyReviewerEvent, never, never>, never, EventStorage>,
  projection: Projection<S, E>
) => {
  return appAtomRuntime.atom(
    Stream.unwrap(stream).pipe(project(projection)),
    { initialValue: projection.initialState }
  );
};

// Sprints List
const sprintsStateAtom = makeProjectedAtomFromProjection(EventStorage.combinedEventsStream, sprintsProjection);

export const sprintsAtom = Atom.map(sprintsStateAtom, (result) =>
  Result.getOrElse(result, () => sprintsProjection.initialState).sprints
);

export const boardIdAtom = Atom.map(sprintsStateAtom, (result) =>
  Result.getOrElse(result, () => sprintsProjection.initialState).boardId
);

// Selection
const selectionStateAtom = makeProjectedAtomFromProjection(EventStorage.combinedEventsStream, selectionProjection);

export const selectedSprintIdAtom = Atom.map(selectionStateAtom, (result) =>
  Result.getOrElse(result, () => selectionProjection.initialState).selectedSprintId
);

export const selectedSprintAtom = Atom.readable((get) => {
  const sprints = get(sprintsAtom);
  const selectedId = get(selectedSprintIdAtom);
  return sprints.find((s) => s.id === selectedId) ?? null;
});

// Sprint Issues (stored by sprintId)
const sprintIssuesStateAtom = makeProjectedAtomFromProjection(EventStorage.inMemoryEventsStream, sprintIssuesProjection);

export const sprintIssuesByIdAtom = Atom.map(sprintIssuesStateAtom, (result) =>
  Result.getOrElse(result, () => sprintIssuesProjection.initialState).issuesBySprintId
);

// Derived atom: check if we have cached issues for the selected sprint
export const hasIssuesForSelectedSprintAtom = Atom.readable((get) => {
  const selectedSprintId = get(selectedSprintIdAtom);
  const issuesBySprintId = get(sprintIssuesByIdAtom);
  return selectedSprintId !== null && issuesBySprintId.has(selectedSprintId);
});

// Derived atom: build tree from cached issues based on selected sprint
export const sprintTreeAtom = Atom.readable((get) => {
  const selectedSprintId = get(selectedSprintIdAtom);
  const issuesBySprintId = get(sprintIssuesByIdAtom);

  if (selectedSprintId === null) {
    return [];
  }

  const issues = issuesBySprintId.get(selectedSprintId);
  if (!issues || issues.length === 0) {
    return [];
  }

  return buildSprintTree(issues);
});

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
