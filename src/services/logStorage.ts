import { Effect, SubscriptionRef } from "effect"
import { FileSystem, Path } from "@effect/platform"

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export class LogStorage extends Effect.Service<LogStorage>()("LogStorage", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const logsRef = yield* SubscriptionRef.make<LogEntry[]>([])

    // Create log file with datetime-based name
    const now = new Date()
    const dateTimeStr = now.toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '') // Remove milliseconds and timezone
    const logFileName = `logs-${dateTimeStr}.log`
    const logsDir = path.join("logs")
    const logFilePath = path.join(logsDir, logFileName)

    // Ensure logs directory exists
    yield* fs.makeDirectory(logsDir, { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void) // Ignore error if directory exists
    )

    // Write header to log file
    const header = `=== Log started at ${now.toISOString()} ===\n`
    yield* fs.writeFileString(logFilePath, header)

    const addLog = (level: LogEntry['level'], message: string) => {
      const timestamp = new Date().toLocaleTimeString()
      const logEntry: LogEntry = { timestamp, level, message }

      // Format log line for file
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`

      // Write to file and update SubscriptionRef
      return Effect.gen(function* () {
        yield* fs.writeFileString(logFilePath, logLine, { flag: "a" }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => console.error('Failed to write log to file:', error))
          )
        )
        yield* SubscriptionRef.update(logsRef, logs =>
          [...logs, logEntry].slice(-100) // Keep last 100 entries in memory
        )
      })
    }

    return { logsRef, addLog } as const
  })
}) {}
