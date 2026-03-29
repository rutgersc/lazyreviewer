import { Stream, Effect } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";
import { groupedWithin } from "../utils/groupedWithin";

const eventsStreamEffect = Effect.gen(function* () {
  const eventStorage = yield* EventStorage
  return eventStorage.eventsStream
})

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(eventsStreamEffect).pipe(
    groupedWithin(300, "0.3 seconds"),
    Stream.scan([] as LazyReviewerEvent[], (acc, events) =>
      acc.concat(events).slice(-500)
    )
  ),
  { initialValue: [] }
)
