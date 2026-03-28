import { Stream, Chunk, Effect } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";

const eventsStreamEffect = Effect.gen(function* () {
  const eventStorage = yield* EventStorage
  return eventStorage.eventsStream
})

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(eventsStreamEffect).pipe(
    Stream.groupedWithin(300, "0.3 seconds"),
    Stream.scan([] as LazyReviewerEvent[], (acc, events) =>
      acc.concat(Chunk.toReadonlyArray(events)).slice(-500)
    )
  ),
  { initialValue: [] }
)
