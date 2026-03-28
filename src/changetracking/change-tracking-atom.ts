import { Atom } from "effect/unstable/reactivity"
import { Effect, Stream } from 'effect'
import { EventStorage } from '../events/events'
import {
  jiraChangeTrackingProjection,
  mrChangeTrackingProjection,
  type Change,
  type JiraStateForDelta,
  type MrStateForDelta
} from './change-tracking-projection'
import type { LazyReviewerEvent } from '../events/events'
import { appAtomRuntime } from '../appLayerRuntime'
import { groupChanges } from './change-grouping'
import { FILTERED_SYSTEM_NOTE_TYPES } from './mr-change-tracking-projection'

const isFilteredSystemNote = (change: Change): boolean =>
  change.type === 'system-note' && FILTERED_SYSTEM_NOTE_TYPES.has(change.systemNoteType);

export interface ChangeTrackingState {
  mrStateForDeltaByMrId: Map<string, MrStateForDelta>,
  jiraStateForDeltaByIssueKey: Map<string, JiraStateForDelta>,
  deltasByEventId: Map<string, Change[]>,
  groupedDeltasByEventId: Map<string, Change[]>,
  event?: LazyReviewerEvent
}

const initialAccumulator: ChangeTrackingState = {
  mrStateForDeltaByMrId: new Map(),
  jiraStateForDeltaByIssueKey: new Map(),
  deltasByEventId: new Map(),
  groupedDeltasByEventId: new Map()
}

export const changesStream = Effect.fn(function* (_get: Atom.Context) {
  const eventStorage = yield* EventStorage
  return eventStorage.eventsStream.pipe(
    Stream.filter((event) => mrChangeTrackingProjection.isRelevantEvent(event) || jiraChangeTrackingProjection.isRelevantEvent(event)),
    Stream.groupedWithin(300, "0.3 seconds"),
    Stream.tap(() => Effect.sleep("200 millis")),
    Stream.scan(
      initialAccumulator,
      (state: ChangeTrackingState, events) =>
        events.reduce<ChangeTrackingState>((acc, event) => {
          const { mrDeltas, mrStatesForDelta } = mrChangeTrackingProjection.isRelevantEvent(event)
            ? mrChangeTrackingProjection.project({ mrStatesForDelta: acc.mrStateForDeltaByMrId, mrDeltas: [] }, event)
            : { mrDeltas: [], mrStatesForDelta: acc.mrStateForDeltaByMrId };

          const { jiraDeltas, jiraStatesForDelta } = jiraChangeTrackingProjection.isRelevantEvent(event)
            ? jiraChangeTrackingProjection.project({ jiraStatesForDelta: acc.jiraStateForDeltaByIssueKey, jiraDeltas: [] }, event)
            : { jiraDeltas: [], jiraStatesForDelta: acc.jiraStateForDeltaByIssueKey };

          const sortedDeltas = [...mrDeltas, ...jiraDeltas]
            .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

          const newDeltasByEventId = new Map(acc.deltasByEventId);
          newDeltasByEventId.set(event.eventId, sortedDeltas);

          const newGroupedDeltasByEventId = new Map(acc.groupedDeltasByEventId);
          newGroupedDeltasByEventId.set(
            event.eventId,
            groupChanges(sortedDeltas.filter(c => !isFilteredSystemNote(c)))
          );

          return {
            mrStateForDeltaByMrId: mrStatesForDelta,
            jiraStateForDeltaByIssueKey: jiraStatesForDelta,
            deltasByEventId: newDeltasByEventId,
            groupedDeltasByEventId: newGroupedDeltasByEventId,
            event: event,
          };
        }, state)
    )
  );
});

export const eventChangesReadmodelAtom = appAtomRuntime
  .atom(get =>
    Stream.unwrap(changesStream(get)))
  .pipe(
    Atom.keepAlive);
