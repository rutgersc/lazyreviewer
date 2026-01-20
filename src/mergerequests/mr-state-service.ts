import { Effect, Stream, SubscriptionRef, Chunk } from "effect"
import { EventStorage } from "../events/events"
import { allMrsProjection, type AllMrsState } from "./all-mergerequests-projection"

export class MrStateService extends Effect.Service<MrStateService>()("MrStateService", {
  accessors: true,
  scoped: Effect.gen(function* () {
    const stateRef = yield* SubscriptionRef.make(allMrsProjection.initialState)

    yield* (yield* EventStorage.eventsStream).pipe(
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
      changes: stateRef.changes
    }
  })
}) {}
