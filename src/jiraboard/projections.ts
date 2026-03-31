import type { JiraSprint } from "./schema";
import type { JiraIssue } from "../jira/jira-schema";
import { defineProjection } from "../utils/define-projection";

export type SprintsState =
  | { _type: 'NoSprintsState' }
  | {
    _type: 'SprintsState'
    sprints: JiraSprint[];
  };

export const sprintsProjection = defineProjection({
  initialState: { _type: 'NoSprintsState' } as SprintsState,
  handlers: {
    "jira-sprints-loaded-event": (state, event) => {
      console.log(`[Projection] Sprints loaded: ${event.sprints.length} sprints for board ${event.boardId}`);
      return {
        _type: 'SprintsState',
        sprints: event.sprints,
      } satisfies SprintsState;
    },
  },
});

export type SprintIssuesState = {
  issuesBySprintId: Map<number, JiraIssue[]>;
};

export const initialSprintIssuesState: SprintIssuesState = {
  issuesBySprintId: new Map(),
};

export const sprintIssuesProjection = defineProjection({
  initialState: initialSprintIssuesState,
  handlers: {
    "jira-sprint-issues-fetched-event": (state, event) => {
      const newMap = new Map(state.issuesBySprintId);
      newMap.set(event.sprintId, event.issues);
      return { ...state, issuesBySprintId: newMap };
    },
  },
});
