import { Layer, Effect, Console } from "effect"
import { LogStorage } from "./logStorage"

export const ConsoleLogged = Layer.effect(
  Console.Console,
  Effect.gen(function* () {
    const console = yield* Console.Console
    const logStorage = yield* LogStorage

    const formatArgs = (args: ReadonlyArray<any>): string =>
      args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')

    // Return an object implementing the Console interface
    return {
      log: (...args: ReadonlyArray<any>) =>
        Effect.zipRight(
          console.log(...args),
          logStorage.addLog('info', formatArgs(args))
        ),

      warn: (...args: ReadonlyArray<any>) =>
        Effect.zipRight(
          console.warn(...args),
          logStorage.addLog('warn', formatArgs(args))
        ),

      error: (...args: ReadonlyArray<any>) =>
        Effect.zipRight(
          console.error(...args),
          logStorage.addLog('error', formatArgs(args))
        ),

      debug: (...args: ReadonlyArray<any>) =>
        Effect.zipRight(
          console.debug(...args),
          logStorage.addLog('debug', formatArgs(args))
        ),

      // Delegate other Console methods directly
      assert: console.assert,
      clear: console.clear,
      dir: console.dir,
      dirxml: console.dirxml,
      group: console.group,
      groupEnd: console.groupEnd,
      table: console.table,
      time: console.time,
      timeEnd: console.timeEnd,
      timeLog: console.timeLog,
      trace: console.trace,
      count: console.count,
      countReset: console.countReset,
      info: console.info,
      unsafe: console.unsafe
    } as Console.Console
  })
)
