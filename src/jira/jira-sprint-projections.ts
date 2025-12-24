import type { JiraSprint } from "./jira-sprint-schema";
import type { JiraIssue } from "./jira-schema";
import type {
  AnyLazyReviewerEvent,
  JiraSprintsLoadedEvent,
  JiraSprintSelectedEvent
} from "../events/events";
import { defineProjection, type ProjectionEventType } from "../events/define-projection";

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

export const projectSprints = (state: SprintsState, event: AnyLazyReviewerEvent): SprintsState => {
  switch (event.type) {
    case "jira-sprints-loaded-event": {
      const e = event as JiraSprintsLoadedEvent;
      console.log(`[Projection] Sprints loaded: ${e.sprints.length} sprints for board ${e.boardId}`);
      return {
        ...state,
        sprints: e.sprints,
        boardId: e.boardId,
      };
    }
    default:
      return state;
  }
};

// =============================================================================
// Selected Sprint Projection
// =============================================================================
export type SelectionState = {
  selectedSprintId: number | null;
};

export const initialSelectionState: SelectionState = {
  selectedSprintId: null,
};

export const projectSelection = (state: SelectionState, event: AnyLazyReviewerEvent): SelectionState => {
  switch (event.type) {
    case "jira-sprint-selected-event": {
      const e = event as JiraSprintSelectedEvent;
      console.log(`[Projection] Sprint selected: ${e.sprintId}`);
      return {
        ...state,
        selectedSprintId: e.sprintId,
      };
    }
    case "jira-sprints-loaded-event": {
      const e = event as JiraSprintsLoadedEvent;
      // Auto-select first sprint if none selected
      if (!state.selectedSprintId && e.sprints.length > 0) {
        console.log(`[Projection] Auto-selecting first sprint: ${e.sprints[0]!.id}`);
        return {
          ...state,
          selectedSprintId: e.sprints[0]!.id,
        };
      }
      return state;
    }
    default:
      return state;
  }
};

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
