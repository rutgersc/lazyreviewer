import { Atom, Result } from '@effect-atom/atom-react'
import { Effect, Stream } from 'effect'
import { appAtomRuntime } from '../appLayerRuntime'
import { EventStorage } from '../events/events'
import { isChangeTrackingRelevantEvent, projectChangeTracking, type ChangeTrackingStates } from './change-tracking-projection'
import type { LazyReviewerEvent } from '../events/events'
import { allMrsAtom } from '../mergerequests/mergerequests-atom'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

interface ChangeTrackingAccumulator {
  state: ChangeTrackingStates,
  event?: LazyReviewerEvent
}

function writeDebugChangeFiles(
  event: LazyReviewerEvent,
  changes: ChangeTrackingStates,
  get: Atom.Context
): void {
  try {
    const debugDir = join(process.cwd(), "debug", "changes");
    mkdirSync(debugDir, { recursive: true });

    const fileTimestamp = event.timestamp.replace(/[:.]/g, "-");
    const baseFilename = `${fileTimestamp}_${event.type}_changes`;

    const totalCommentDeltas = [...changes.mrs.values()].reduce(
      (sum, mrState) => sum + mrState.commentsDelta.size,
      0
    );
    const totalStateDeltas = [...changes.mrs.values()].filter(
      mrState => mrState.stateDelta !== undefined
    ).length;

    const allMrsResult = get.registry.get(allMrsAtom);
    const allMrsState = Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    });

    const rawData = {
      eventType: event.type,
      timestamp: event.timestamp,
      summary: {
        totalMRs: changes.mrs.size,
        totalCommentDeltas,
        totalStateDeltas
      },
      mrs: Object.fromEntries(
        [...changes.mrs.entries()].map(([mrId, mrState]) => {
          const mr = allMrsState?.mrsByGid.get(mrId);
          return [
            mrId,
            {
              name: mr ? `!${mr.iid} - ${mr.title}` : mrId,
              state: mrState.state,
              noteIds: [...mrState.noteIds],
              commentsDelta: [...mrState.commentsDelta],
              stateDelta: mrState.stateDelta
            }
          ];
        })
      )
    };

    writeFileSync(join(debugDir, `${baseFilename}.json`), JSON.stringify(rawData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write debug change files:', error);
  }
}

const initialState: ChangeTrackingAccumulator = {
  state: { mrs: new Map() }
}

export const changesStream = Effect.fn(function* (get: Atom.Context) {
  return (yield* EventStorage.eventsStream).pipe(
    Stream.filter((event) => isChangeTrackingRelevantEvent(event)),
    Stream.tap(() => Effect.sleep("200 millis")),
    Stream.scan(initialState, (acc: ChangeTrackingAccumulator, event) => {
      const newState = projectChangeTracking(acc.state, event);

      writeDebugChangeFiles(event, newState, get);

      return {
        state: newState,
        event: event
      };
    })
  );
});
