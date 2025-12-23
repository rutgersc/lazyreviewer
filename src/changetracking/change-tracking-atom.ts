import { Atom } from '@effect-atom/atom-react'
import { Chunk, Effect, Stream } from 'effect'
import { EventStorage } from '../events/events'
import {
  isChangeTrackingRelevantEvent,
  isJiraChangeTrackingRelevantEvent,
  isMrChangeTrackingRelevantEvent,
  projectJiraChangeTracking,
  projectMrChangeTracking,
  type Change,
  type JiraStateForDelta,
  type MrStateForDelta
} from './change-tracking-projection'
import type { LazyReviewerEvent } from '../events/events'
import { appAtomRuntime } from '../appLayerRuntime'

export interface ChangeTrackingState {
  mrStateForDeltaByMrId: Map<string, MrStateForDelta>,
  jiraStateForDeltaByIssueKey: Map<string, JiraStateForDelta>,
  deltasByEventId: Map<string, Change[]>,
  event?: LazyReviewerEvent
}

const initialAccumulator: ChangeTrackingState = {
  mrStateForDeltaByMrId: new Map(),
  jiraStateForDeltaByIssueKey: new Map(),
  deltasByEventId: new Map()
}

export const changesStream = Effect.fn(function* (_get: Atom.Context) {
  return (yield* EventStorage.eventsStream).pipe(
    Stream.filter((event) => isChangeTrackingRelevantEvent(event)),
    Stream.groupedWithin(300, "0.3 seconds"),
    Stream.tap(() => Effect.sleep("200 millis")),
    Stream.scan(
      initialAccumulator,
      (state: ChangeTrackingState, events) =>
        Chunk.reduce(events, state, (state, event) => {
          const { mrDeltas, mrStatesForDelta } = isMrChangeTrackingRelevantEvent(event)
            ? projectMrChangeTracking(state.mrStateForDeltaByMrId, event)
            : { mrDeltas: [], mrStatesForDelta: state.mrStateForDeltaByMrId };

          const { jiraDeltas, jiraStatesForDelta } = isJiraChangeTrackingRelevantEvent(event)
            ? projectJiraChangeTracking(state.jiraStateForDeltaByIssueKey, event)
            : { jiraDeltas: [], jiraStatesForDelta: state.jiraStateForDeltaByIssueKey };

          const deltas = [...mrDeltas, ...jiraDeltas];

          return {
            mrStateForDeltaByMrId: mrStatesForDelta,
            jiraStateForDeltaByIssueKey: jiraStatesForDelta,
            deltasByEventId: state.deltasByEventId.set(
              event.eventId,
              deltas.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
            ),
            event: event,
          } satisfies ChangeTrackingState;
        })
    )
  );
});

export const eventChangesReadmodelAtom = appAtomRuntime
  .atom(get => Stream.unwrap(changesStream(get)))
  .pipe(
    Atom.keepAlive);
