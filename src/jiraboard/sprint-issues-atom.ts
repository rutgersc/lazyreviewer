import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { EventStorage } from "../events/events";
import { makeProjectedAtomFromProjection } from "../appLayerRuntime";
import { defineProjection } from "../utils/define-projection";
import type { JiraIssue } from "../jira/jira-schema";
import { sprintFilterAtom } from "../settings/settings-atom";

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
  Atom.map((result) =>
    result.pipe(AsyncResult.getOrElse(() => sprintIssuesProjection.initialState))
  )
);

const emptySet: ReadonlySet<string> = new Set();

export const sprintFilterIssueKeysAtom = Atom.readable((get): ReadonlySet<string> => {
  const filter = get(sprintFilterAtom);
  if (!filter) return emptySet;
  const issuesBySprintId = get(sprintIssuesByIdAtom);
  const issues = issuesBySprintId.get(filter.id);
  if (!issues || issues.length === 0) return emptySet;
  return new Set(issues.map(issue => issue.key));
});
