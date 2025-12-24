import type { JiraSprint } from "./jira-sprint-schema";
import type { JiraIssue } from "./jira-schema";
import { defineProjection } from "../utils/define-projection";

// =============================================================================
// Sprints List Projection
// =============================================================================
export type SprintsState = {
  sprints: JiraSprint[];
  boardId: number | null;
};

export const initialSprintsState: SprintsState = {
  sprints: [],
  boardId: null,
};

export const sprintsProjection = defineProjection({
  initialState: initialSprintsState,
  handlers: {
    "jira-sprints-loaded-event": (state, event) => {
      console.log(`[Projection] Sprints loaded: ${event.sprints.length} sprints for board ${event.boardId}`);
      return {
        ...state,
        sprints: event.sprints,
        boardId: event.boardId,
      };
    },
  },
});

// =============================================================================
// Selected Sprint Projection
// =============================================================================
export type SelectionState = {
  selectedSprintId: number | null;
};

export const initialSelectionState: SelectionState = {
  selectedSprintId: null,
};

export const selectionProjection = defineProjection({
  initialState: initialSelectionState,
  handlers: {
    "jira-sprint-selected-event": (state, event) => {
      console.log(`[Projection] Sprint selected: ${event.sprintId}`);
      return {
        ...state,
        selectedSprintId: event.sprintId,
      };
    },
    "jira-sprints-loaded-event": (state, event) => {
      // Auto-select first sprint if none selected
      if (!state.selectedSprintId && event.sprints.length > 0) {
        console.log(`[Projection] Auto-selecting first sprint: ${event.sprints[0]!.id}`);
        return {
          ...state,
          selectedSprintId: event.sprints[0]!.id,
        };
      }
      return state;
    },
  },
});

// =============================================================================
// Sprint Issues Projection (stores issues by sprintId)
// =============================================================================
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
