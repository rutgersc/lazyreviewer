import { Effect, FileSystem, Path, Schema, ServiceMap, Stream, PubSub, Console, Ref } from "effect"
import { EventSchema, type LazyReviewerEvent, type InMemoryLazyReviewerEvent, type AnyLazyReviewerEvent } from "../events/events"
import { appDataPath } from "../system/app-data-dir"

const EVENTS_DIR = appDataPath("events")

// Migration: add missing fields to old events before schema validation
const migrateEventJson = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null) return data
  if (Array.isArray(data)) return data.map(migrateEventJson)

  const obj = data as Record<string, unknown>
  const migrated = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, migrateEventJson(v)])
  )

  // Add detailedMergeStatus: null to MR objects (identified by having iid + sourceBranch)
  if ('iid' in migrated && 'sourceBranch' in migrated && !('detailedMergeStatus' in migrated)) {
    migrated.detailedMergeStatus = null
  }

  return migrated
}

export class EventStorage extends ServiceMap.Service<EventStorage>()("EventStorage", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const eventsDir = path.join(EVENTS_DIR)

    // Persisted events pubsub
    const eventsPubSub = yield* PubSub.unbounded<LazyReviewerEvent>()

    // In-memory events storage + pubsub
    const inMemoryEventsRef = yield* Ref.make<InMemoryLazyReviewerEvent[]>([])
    const inMemoryEventsPubSub = yield* PubSub.unbounded<InMemoryLazyReviewerEvent>()

    // Ensure events directory exists
    yield* fs.makeDirectory(eventsDir, { recursive: true }).pipe(
      Effect.catch(() => Effect.void)
    )

    const parseFilename = (filename: string) => {
      // Format: {number}_{eventId}.json
      // Example: 5_2025-11-08T14-30-25-123Z_gitlab-user-mrs-fetched-event_a1b2c3d4.json
      const match = filename.match(/^(\d+)_(.+)\.json$/)
      if (!match) return null

      const numberStr = match[1]
      const eventId = match[2]

      if (!numberStr || !eventId) return null

      const eventNumber = parseInt(numberStr, 10)

      if (isNaN(eventNumber)) return null

      // Extract event type from eventId (format: timestamp_type_random)
      const eventIdParts = eventId.split('_')
      const eventType = eventIdParts.length >= 2 ? eventIdParts.slice(1, -1).join('_') : undefined

      return {
        eventNumber,
        eventId,
        eventType,
        filename
      }
    }

    const loadEvents = Effect.gen(function* () {
      const files = yield* fs.readDirectory(eventsDir).pipe(
        Effect.catch(() => Effect.succeed([]))
      )

      // Parse filenames and filter valid event files
      const parsedFiles = files
        .map(parseFilename)
        .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null)
        .sort((a, b) => a.eventNumber - b.eventNumber)

      // Load and parse each event file with Schema validation
      const events = yield* Effect.all(
        parsedFiles.map(parsed =>
          Effect.gen(function* () {
            const filePath = path.join(eventsDir, parsed.filename)
            const content = yield* fs.readFileString(filePath)

            const jsonData = yield* Effect.try({
              try: () => migrateEventJson(JSON.parse(content)),
              catch: (error) => new Error(`JSON parse error: ${error}`)
            })
            const event = yield* Schema.decodeUnknownEffect(EventSchema)(jsonData)

            return event as LazyReviewerEvent
          }).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* Console.log(`Failed to load event file ${parsed.filename}: ${error}`)
                return null
              })
            )
          )
        ),
        { concurrency: "unbounded" }
      )

      return events.filter((event): event is LazyReviewerEvent => event !== null)
    })

    const appendEvent = (event: LazyReviewerEvent) => Effect.gen(function* () {
      const files = yield* fs.readDirectory(eventsDir);

      const eventNumbers = files
        .map(parseFilename)
        .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null)
        .map(parsed => parsed.eventNumber)

      const nextNumber = eventNumbers.length > 0
        ? Math.max(...eventNumbers) + 1
        : 0

      // Create filename using eventId
      const filename = `${nextNumber}_${event.eventId}.json`
      const filePath = path.join(eventsDir, filename)

      const encodeEvent = Schema.encodeSync(EventSchema)
      const eventJson = JSON.stringify(encodeEvent(event), null, 2)

      yield* Console.log(`[EventStorage] Appended: ${filename}`)
      yield* fs.writeFileString(filePath, eventJson)
      yield* PubSub.publish(eventsPubSub, event)

      return nextNumber
    })

    const eventsStream = Stream.unwrap(
      Effect.gen(function* () {
        const historicalEvents = yield* loadEvents

        const newEventsStream = Stream.fromPubSub(eventsPubSub)

        return Stream.concat(
          Stream.fromIterable(historicalEvents),
          newEventsStream
        )
      })
    )

    const getEventFilePath = (eventIndex: number) => Effect.gen(function* () {
      const files = yield* fs.readDirectory(eventsDir).pipe(
        Effect.catch(() => Effect.succeed([]))
      )

      const parsedFiles = files
        .map(filename => ({ filename, parsed: parseFilename(filename) }))
        .filter(({ parsed }) => parsed !== null)
        .sort((a, b) => a.parsed!.eventNumber - b.parsed!.eventNumber)

      if (eventIndex < 0 || eventIndex >= parsedFiles.length) {
        return yield* Effect.fail(new Error(`Event index ${eventIndex} out of range`))
      }

      const file = parsedFiles[eventIndex]
      if (!file) {
        return yield* Effect.fail(new Error(`Event file not found at index ${eventIndex}`))
      }

      return path.join(eventsDir, file.filename)
    })

    // Append in-memory event (not persisted to disk)
    const appendInMemoryEvent = (event: InMemoryLazyReviewerEvent) =>
      Effect.gen(function* () {
        yield* Ref.update(inMemoryEventsRef, (events) => [...events, event])
        yield* PubSub.publish(inMemoryEventsPubSub, event)
      })

    // Stream of just in-memory events
    const inMemoryEventsStream = Stream.unwrap(
      Effect.gen(function* () {
        const historicalEvents = yield* Ref.get(inMemoryEventsRef)
        const newEventsStream = Stream.fromPubSub(inMemoryEventsPubSub)

        return Stream.concat(
          Stream.fromIterable(historicalEvents),
          newEventsStream
        )
      })
    )

    // Combined stream of both persisted and in-memory events
    const combinedEventsStream = Stream.unwrap(
      Effect.gen(function* () {
        // Subscribe to pubsubs BEFORE loading historical events
        // This ensures no events are lost between loading and subscribing
        const persistedQueue = yield* PubSub.subscribe(eventsPubSub)
        const inMemoryQueue = yield* PubSub.subscribe(inMemoryEventsPubSub)

        // Load historical events
        const persistedEvents = yield* loadEvents
        const memoryEvents = yield* Ref.get(inMemoryEventsRef)

        const historicalEvents: AnyLazyReviewerEvent[] = [
          ...persistedEvents,
          ...memoryEvents
        ]

        // Create streams from the subscriptions
        const newPersistedStream = Stream.fromSubscription(persistedQueue).pipe(
          Stream.map((e): AnyLazyReviewerEvent => e)
        )
        const newInMemoryStream = Stream.fromSubscription(inMemoryQueue).pipe(
          Stream.map((e): AnyLazyReviewerEvent => e)
        )

        return Stream.concat(
          Stream.fromIterable(historicalEvents),
          Stream.merge(newPersistedStream, newInMemoryStream)
        )
      })
    )

    // Clear in-memory events
    const clearInMemoryEvents = Ref.set(inMemoryEventsRef, [] as InMemoryLazyReviewerEvent[])

    const deleteEventsByIds = (eventIds: ReadonlyArray<string>) => Effect.gen(function* () {
      if (eventIds.length === 0) return 0

      const idsToDelete = new Set(eventIds)
      const files = yield* fs.readDirectory(eventsDir).pipe(
        Effect.catch(() => Effect.succeed([]))
      )

      const toDelete = files.filter(filename => {
        const parsed = parseFilename(filename)
        return parsed !== null && idsToDelete.has(parsed.eventId)
      })

      yield* Effect.all(
        toDelete.map(filename =>
          fs.remove(path.join(eventsDir, filename)).pipe(
            Effect.catch(() => Effect.void)
          )
        ),
        { concurrency: "unbounded" }
      )

      yield* Console.log(`[EventStorage] Cleanup: deleted ${toDelete.length} events by ID`)

      return toDelete.length
    })

    return {
      loadEvents,
      appendEvent,
      appendInMemoryEvent,
      eventsStream,
      inMemoryEventsStream,
      combinedEventsStream,
      clearInMemoryEvents,
      getEventFilePath,
      deleteEventsByIds,
    } as const
  })
}) {}
