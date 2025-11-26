import { Stream, Effect } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";
import { Atom } from "@effect-atom/atom-react";
import { compactedStateStream, persistCompactedState } from "../mergerequests/mergerequest-compaction-projection";

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.eventsStream).pipe(
    Stream.scan([] as LazyReviewerEvent[], (acc, event) => [...acc, event])
  ),
  { initialValue: [] }
)

export const selectedEventIndexAtom = Atom.make<number | null>(null);

export const compactStateUpToSelectedEventAtom = appAtomRuntime.fn((selectedIndex: number | null) =>
  Effect.gen(function* () {
    if (selectedIndex === null) {
      return { success: false, message: "No event selected" };
    }

    const stateStream = yield* compactedStateStream;
    const states = yield* Stream.runCollect(
      stateStream.pipe(Stream.take(selectedIndex + 1))
    );

    const finalState = states.pipe((chunk) => Array.from(chunk).pop());

    if (!finalState) {
      return { success: false, message: "No compacted state available" };
    }

    const count = yield* persistCompactedState(finalState);

    return { success: true, message: `Compacted ${count} MRs up to event ${selectedIndex}` };
  })
);