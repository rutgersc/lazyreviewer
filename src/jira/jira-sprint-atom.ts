import { Atom, Result } from "@effect-atom/atom-react";
import { Effect } from "effect";
import { EventStorage } from "../events/events";
import { generateEventId } from "../events/event-id";
import { appAtomRuntime, makeProjectedAtomFromProjection } from "../appLayerRuntime";
import { fetchActiveSprints, loadSprintTreeAsEvent } from "./jira-sprint-service";
import { sprintsProjection } from "./jira-sprint-projections";
import { defineProjection } from "../utils/define-projection";
import type { JiraIssue } from "./jira-schema";
import { selectedSprintIdAtom } from "../components/JiraBoardPage";

// =============================================================================
// Projected Atoms
// =============================================================================

// Sprints List
export const sprintsStateAtom = makeProjectedAtomFromProjection(EventStorage.eventsStream, sprintsProjection);

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

export const sprintIssuesByIdAtom = makeProjectedAtomFromProjection(
  EventStorage.eventsStream,
  sprintIssuesProjection
).pipe(
  Atom.map((result) => {
    return result.pipe(
      Result.getOrElse(() => sprintIssuesProjection.initialState));
  })
);

export const selectedSprintIssuesAtom = Atom.readable((get) => {
  const selectedSprintId = get(selectedSprintIdAtom);
  const issuesBySprintId = get(sprintIssuesByIdAtom);

  if (selectedSprintId === null) {
    return [];
  }

  return issuesBySprintId.get(selectedSprintId) ?? [];
});


// =============================================================================
// Action Atoms (Appenders)
// =============================================================================

// Load sprints for a board
export const loadSprintsAtom = appAtomRuntime.fn((boardId: number) =>
  Effect.gen(function* () {
    const sprints = yield* fetchActiveSprints(boardId);
    const timestamp = new Date().toISOString();
    const type = "jira-sprints-loaded-event";
    yield* EventStorage.appendEvent({
      eventId: generateEventId(timestamp, type),
      type,
      boardId,
      sprints,
      timestamp,
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
