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

    const log: Console.Console['log'] = (...args: ReadonlyArray<any>) =>
      Effect.zipRight(
        console.log(...args),
        logStorage.addLog('info', formatArgs(args))
      );

    const warn: Console.Console['warn']  = (...args: ReadonlyArray<any>) =>
      Effect.zipRight(
        console.warn(...args),
        logStorage.addLog("warn", formatArgs(args))
      );

    const error: Console.Console['error']  = (...args: ReadonlyArray<any>) =>
      Effect.zipRight(
        console.error(...args),
        logStorage.addLog("error", formatArgs(args))
      );

    const debug: Console.Console['debug']  = (...args: ReadonlyArray<any>) =>
      Effect.zipRight(
        console.debug(...args),
        logStorage.addLog("debug", formatArgs(args))
      );

    return {
      ...console,
      log:  log,
      warn: warn,
      error: error,
      debug: debug,
    };
  })
)
