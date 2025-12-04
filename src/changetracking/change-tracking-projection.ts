import type { LazyReviewerEvent } from '../events/events'
import type {
  GitlabUserMergeRequestsFetchedEvent,
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from '../events/gitlab-events'
import {
  projectGitlabUserMrsFetchedEvent,
  projectGitlabProjectMrsFetchedEvent,
  projectGitlabSingleMrFetchedEvent
} from '../gitlab/gitlab-projections'
import type { GitlabMergeRequest } from '../gitlab/gitlab-schema'

type MrChangeTrackingRelevantEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent

export function isChangeTrackingRelevantEvent(event: LazyReviewerEvent): event is MrChangeTrackingRelevantEvent {
  return event.type === 'gitlab-user-mrs-fetched-event' ||
         event.type === 'gitlab-project-mrs-fetched-event' ||
         event.type === 'gitlab-single-mr-fetched-event'
}

// The minimal subset of fields of an MR that is needed to calculate the diff
export type MrDiffFields = {
  noteIds: Set<string> // includes more than jsut comments
  state: string
}

const getMrChangeTrackingFields = (mr: GitlabMergeRequest): MrDiffFields => {
  return {
    state: mr.state,
    noteIds: new Set(
      mr.discussions
        .flatMap((d) => d.notes)
        .map((n) => n.id)
    )
  }
}

//
export interface MrChangeTrackingDeltaState {
  commentsDelta: Set<string>
  stateDelta?: string
}

export type ChangeTrackingState = MrDiffFields & MrChangeTrackingDeltaState;

// Helper to derive if an MR is new from its state delta
export const isNewMr = (mr: MrChangeTrackingDeltaState): boolean => {
  return mr.stateDelta === 'opened';
};

export interface ChangeTrackingStates {
  mrs: Map<string, ChangeTrackingState>
}

const detectChanges =
  (state: ChangeTrackingStates) => // partial application
  (newGitlabMrs: GitlabMergeRequest[]): ChangeTrackingStates => {
    const calcDelta = (
      existingMr: (MrChangeTrackingDeltaState & MrDiffFields) | undefined,
      latestMr: MrDiffFields
    ): MrChangeTrackingDeltaState => {
      if (!existingMr) {
        return {
          commentsDelta: new Set(),
          stateDelta: latestMr.state
        };
      }

      return {
        commentsDelta: latestMr.noteIds.difference(existingMr.noteIds),
        stateDelta:
          latestMr.state !== existingMr.state
            ? latestMr.state
            : undefined
      };
    };

    const getMrWithDelta = (mr: GitlabMergeRequest): ChangeTrackingState => {
      const previousMr = state.mrs.get(mr.id);
      const latestMr = getMrChangeTrackingFields(mr);
      const delta = calcDelta(previousMr, latestMr);
      return { ...latestMr, ...delta };
    };

    const existingEntries = state.mrs.entries().toArray().map(([mrId, mrState]): [string, ChangeTrackingState] => [
      mrId,
      {
        ...mrState,
        commentsDelta: new Set<string>(),
        stateDelta: undefined
      }
    ]);

    const updatedEntries = newGitlabMrs.map((mr): [string, ChangeTrackingState] => [
      mr.id,
      getMrWithDelta(mr),
    ]);

    return {
      mrs: new Map(existingEntries.concat(updatedEntries)),
    };
  };

// projection functions always have the form (state, event) -> state.
export function projectChangeTracking(
  state: ChangeTrackingStates,
  event: MrChangeTrackingRelevantEvent
): ChangeTrackingStates {

  if (event.type === "gitlab-user-mrs-fetched-event") {
    return detectChanges(state)(projectGitlabUserMrsFetchedEvent(event));
  } else if (event.type === "gitlab-project-mrs-fetched-event") {
    return detectChanges(state)(projectGitlabProjectMrsFetchedEvent(event));
  } else if (event.type === "gitlab-single-mr-fetched-event") {
    const mr = projectGitlabSingleMrFetchedEvent(event);
    return detectChanges(state)(mr ? [mr] : []);
  }

  throw new Error("non-exhaustive match");
}
