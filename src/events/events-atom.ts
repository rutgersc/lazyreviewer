import { Stream, Chunk } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.eventsStream).pipe(
    Stream.groupedWithin(300, "0.3 seconds"),
    Stream.scan([] as LazyReviewerEvent[], (acc, events) =>
      acc.concat(Chunk.toReadonlyArray(events))
    )
  ),
  { initialValue: [] }
)
