import { FileSystem, Path } from "@effect/platform"
import { Effect, Schema, Stream, PubSub, Console } from "effect"
import type { Event } from "./events"
import { EventSchema } from "./eventSchemas"

const EVENTS_DIR = "storage/events"

export class EventStorage extends Effect.Service<EventStorage>()("EventStorage", {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const console = yield* Console.Console;

    const eventsDir = path.join(EVENTS_DIR)

    const eventsPubSub = yield* PubSub.unbounded<Event>()

    // Ensure events directory exists
    yield* fs.makeDirectory(eventsDir, { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void)
    )

    const parseFilename = (filename: string) => {
      // Format: {number}_{timestamp}_{event-type}.json
      // Example: 5_2025-11-08T14-30-25.123Z_gitlab-user-mrs-fetched-event.json
      const match = filename.match(/^(\d+)_(.+?)_(.+)\.json$/)
      if (!match) return null

      const numberStr = match[1]
      const timestamp = match[2]
      const eventType = match[3]

      if (!numberStr || !timestamp || !eventType) return null

      const eventNumber = parseInt(numberStr, 10)

      if (isNaN(eventNumber)) return null

      return {
        eventNumber,
        timestamp: timestamp.replace(/-/g, ':'), // Convert back to ISO format
        eventType,
        filename
      }
    }

    const loadEvents = Effect.gen(function* () {
      yield* console.log("[EventStorage] loading all events..")

      // Read directory
      const files = yield* fs.readDirectory(eventsDir).pipe(
        Effect.catchAll(() => Effect.succeed([]))
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
              try: () => JSON.parse(content),
              catch: (error) => new Error(`JSON parse error: ${error}`)
            })
            const event = yield* Schema.decodeUnknown(EventSchema)(jsonData)

            return event as Event
          }).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logError(`Failed to load event file ${parsed.filename}: ${error}`)
                return null
              })
            )
          )
        ),
        { concurrency: "unbounded" }
      )

      return events.filter((event): event is Event => event !== null)
    })

    const appendEvent = (event: Event) => Effect.gen(function* () {
      const files = yield* fs.readDirectory(eventsDir);

      const eventNumbers = files
        .map(parseFilename)
        .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null)
        .map(parsed => parsed.eventNumber)

      const nextNumber = eventNumbers.length > 0
        ? Math.max(...eventNumbers) + 1
        : 0

      // Generate timestamp
      const timestamp = new Date().toISOString() // "2025-11-08T14:30:25.123Z"
      const fileTimestamp = timestamp.replace(/:/g, '-') // "2025-11-08T14-30-25.123Z"

      // Create filename
      const filename = `${nextNumber}_${fileTimestamp}_${event.type}.json`
      const filePath = path.join(eventsDir, filename)

      // Write event to file
      const eventJson = JSON.stringify(event, null, 2)

      yield* Console.log(`[EventStorage] Appended: ${filename}`)
      yield* fs.writeFileString(filePath, eventJson)
      yield* PubSub.publish(eventsPubSub, event)

      return nextNumber
    })

    const eventsStream = Stream.unwrapScoped(
      Effect.gen(function* () {
        yield* console.log("[EventStorage] new subscriber initializing..")

        const historicalEvents = yield* loadEvents

        const newEventsStream = Stream.fromPubSub(eventsPubSub)

        return Stream.concat(
          Stream.fromIterable(historicalEvents),
          newEventsStream
        )
      })
    )

    return {
      loadEvents,
      appendEvent,
      eventsStream
    } as const
  })
}) {}