import { Effect, Stream, Chunk, Console, HashMap } from "effect"
import { EventStorage } from "../../events/events"
import { eventsToDeleteTodoList } from "./events-to-delete-todolist"

export const ensureEventCleanupDaemon = Effect.gen(function* () {
  yield* Console.log("[EventCleanup] Starting event cleanup daemon")
  const eventStorage = yield* EventStorage

  let deletedSoFar = 0

  yield* (yield* EventStorage.eventsStream).pipe(
    Stream.filter(eventsToDeleteTodoList.isRelevantEvent),
    Stream.groupedWithin(200, "0.33 seconds"),
    Stream.scan(eventsToDeleteTodoList.initialState, (state, events) =>
      Chunk.reduce(events, state, (s, e) => eventsToDeleteTodoList.project(s, e))
    ),
    Stream.runForEach((state) =>
      Effect.gen(function* () {
        const totalMarked = Chunk.size(state.eventIdsToDelete)
        const newToDelete = Chunk.drop(state.eventIdsToDelete, deletedSoFar)
        const newCount = Chunk.size(newToDelete)

        yield* Console.log(
          `[EventCleanup] ${totalMarked}/${state.totalEventCount} events marked for deletion (${HashMap.size(state.eventIdsByGroup)} groups)`
        )

        if (newCount > 0) {
          const ids = Chunk.toReadonlyArray(newToDelete)
          yield* Console.log(`[EventCleanup] Deleting ${newCount} events`)
          yield* eventStorage.deleteEventsByIds(ids)
          deletedSoFar = totalMarked
        }
      })
    ),
    Effect.forkScoped
  )
})
