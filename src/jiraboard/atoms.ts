import { Atom, Result } from "@effect-atom/atom-react";
import { Effect } from "effect";
import { EventStorage } from "../events/events";
import { generateEventId } from "../events/event-id";
import { appAtomRuntime, makeProjectedAtomFromProjection } from "../appLayerRuntime";
import { fetchActiveSprints, loadSprintTreeAsEvent } from "./service";
import { sprintsProjection } from "./projections";
import { defineProjection } from "../utils/define-projection";
import type { JiraIssue } from "../jira/jira-schema";

// UI State Atoms
export const selectedSprintIdAtom = Atom.make<number | null>(null);
export const expandedKeysAtom = Atom.make<Set<string>>(new Set<string>());
const selectedIssueIndexAtom = Atom.make<number>(0);

export { selectedIssueIndexAtom };

// Projected Atoms
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

// Action Atoms
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
