import { Stream, Effect } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";
import { Atom } from "@effect-atom/atom-react";
import { persistCompactedState, projectEvent, isCompactedMergeRequestsEvent, type CompactedMergeRequestEntry } from "../mergerequests/mergerequest-compaction-projection";

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.eventsStream).pipe(
    Stream.scan([] as LazyReviewerEvent[], (acc, event) => [...acc, event])
  ),
  { initialValue: [] }
)

export const selectedEventIndexAtom = Atom.make<number | null>(null);

export const compactAllEventsAtom = appAtomRuntime.fn(() =>
  Effect.gen(function* () {
    // Project all events to get final state
    const finalState = (yield* EventStorage.loadEvents)
      .filter(isCompactedMergeRequestsEvent)
      .reduce(
        (state, event) => projectEvent(state, event),
        new Map<string, CompactedMergeRequestEntry>()
      );

    if (finalState.size === 0) {
      return { success: false, message: "No events to compact" };
    }

    const count = yield* persistCompactedState(finalState);

    return { success: true, message: `Compacted all events into ${count} MRs` };
  })
);