import type { JiraSprint, JiraSprintTree } from "./jira-sprint-schema";
import type {
  InMemoryLazyReviewerEvent,
  AnyLazyReviewerEvent,
  JiraSprintsLoadedEvent,
  JiraSprintSelectedEvent
} from "../events/events";
import type { JiraSprintIssuesFetchedEvent } from "../events/jira-events";
import { buildSprintTree } from "./jira-sprint-service";

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
      return {
        ...state,
        selectedSprintId: e.sprintId,
      };
    }
    case "jira-sprints-loaded-event": {
      const e = event as JiraSprintsLoadedEvent;
      // Auto-select first sprint if none selected
      if (!state.selectedSprintId && e.sprints.length > 0) {
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
// Sprint Tree Projection
// =============================================================================
export type SprintTreeState = {
  tree: JiraSprintTree;
  lastFetchedSprintId: number | null;
};

export const initialSprintTreeState: SprintTreeState = {
  tree: [],
  lastFetchedSprintId: null,
};

export const projectSprintTree = (state: SprintTreeState, event: AnyLazyReviewerEvent): SprintTreeState => {
  switch (event.type) {
    case "jira-sprint-issues-fetched-event": {
      const e = event as JiraSprintIssuesFetchedEvent;
      return {
        ...state,
        tree: buildSprintTree(e.issues as any[]),
        lastFetchedSprintId: e.sprintId,
      };
    }
    default:
      return state;
  }
};
