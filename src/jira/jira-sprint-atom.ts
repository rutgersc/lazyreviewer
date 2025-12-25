import { Atom, Result } from "@effect-atom/atom-react";
import { Effect } from "effect";
import { EventStorage } from "../events/events";
import { appAtomRuntime, makeProjectedAtomFromProjection } from "../appLayerRuntime";
import { fetchActiveSprints, loadSprintTreeAsEvent, buildSprintTree } from "./jira-sprint-service";
import { sprintsProjection } from "./jira-sprint-projections";
import { defineProjection } from "../utils/define-projection";
import type { JiraIssue } from "./jira-schema";
import { selectedSprintIdAtom } from "../components/JiraBoardPage";

// =============================================================================
// Projected Atoms
// =============================================================================

// Sprints List
export const sprintsStateAtom = makeProjectedAtomFromProjection(EventStorage.inMemoryEventsStream, sprintsProjection)
  .pipe(
    Atom.map(v => {
      return v;
      // return v.pipe(Result.getOrElse(() => null))
    })
  );

export const sprintIssuesProjection = defineProjection({
  initialState: new Map<number, JiraIssue[]>(),
  handlers: {
    "jira-sprint-issues-fetched-event": (state, event) => {
      const newMap = new Map(state);
      newMap.set(event.sprintId, event.issues);
      return newMap;
    },
  },
});

const sprintIssuesByIdAtom = makeProjectedAtomFromProjection(
  EventStorage.inMemoryEventsStream,
  sprintIssuesProjection
).pipe(
  Atom.map((result) => {
    return result.pipe(
      Result.getOrElse(() => sprintIssuesProjection.initialState));
  })
);

export const hasIssuesForSelectedSprintAtom = Atom.readable((get) => {
  const selectedSprintId = get(selectedSprintIdAtom);
  const issuesBySprintId = get(sprintIssuesByIdAtom);

  return selectedSprintId !== null && issuesBySprintId.has(selectedSprintId);
});

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
