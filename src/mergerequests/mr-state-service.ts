import { Effect, ServiceMap, Stream, SubscriptionRef, Chunk } from "effect"

import { EventStorage } from "../events/events"
import { allMrsProjection } from "./all-mergerequests-projection"

export class MrStateService extends ServiceMap.Service<MrStateService>()("MrStateService", {
  make: Effect.gen(function* () {
    const stateRef = yield* SubscriptionRef.make(allMrsProjection.initialState)
    const eventStorage = yield* EventStorage

    yield* eventStorage.eventsStream.pipe(
      Stream.filter(allMrsProjection.isRelevantEvent),
      Stream.groupedWithin(200, "0.33 seconds"),
      Stream.scan(allMrsProjection.initialState, (state, events) =>
        Chunk.reduce(events, state, (s, e) => allMrsProjection.project(s, e))
      ),
      Stream.runForEach((state) => SubscriptionRef.set(stateRef, state)),
      Effect.forkScoped
    )

    return {
      get: SubscriptionRef.get(stateRef),
      changes: SubscriptionRef.changes(stateRef)
    }
  })
}) {}
