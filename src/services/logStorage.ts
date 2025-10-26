import { Effect, SubscriptionRef } from "effect"

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export class LogStorage extends Effect.Service<LogStorage>()("LogStorage", {
  effect: Effect.gen(function* () {
    const logsRef = yield* SubscriptionRef.make<LogEntry[]>([])

    const addLog = (level: LogEntry['level'], message: string) =>
      SubscriptionRef.update(logsRef, logs =>
        [...logs, {
          timestamp: new Date().toLocaleTimeString(),
          level,
          message
        }].slice(-100) // Keep last 100 entries
      )

    return { logsRef, addLog } as const
  })
}) {}
