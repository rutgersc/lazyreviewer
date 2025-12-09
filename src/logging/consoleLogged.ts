import { Layer, Effect, Console } from "effect"
import { LogStorage } from "./logStorage"

const TypeId: Console.TypeId = Symbol.for("effect/Console") as Console.TypeId

const formatArgs = (args: ReadonlyArray<unknown>): string =>
  args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')

const makeConsoleLogged = Effect.gen(function* () {
  const logStorage = yield* LogStorage

  const wrappedConsole: Console.Console = {
    [TypeId]: TypeId,
    assert: (condition, ...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.assert(condition, ...args)),
        logStorage.addLog('info', `assert: ${formatArgs(args)}`)
      ),
    clear: Effect.sync(() => globalThis.console.clear()),
    count: (label) => Effect.sync(() => globalThis.console.count(label)),
    countReset: (label) => Effect.sync(() => globalThis.console.countReset(label)),
    debug: (...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.debug(...args)),
        logStorage.addLog('debug', formatArgs(args))
      ),
    dir: (item, options) => Effect.sync(() => globalThis.console.dir(item, options)),
    dirxml: (...args) => Effect.sync(() => globalThis.console.dirxml(...args)),
    error: (...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.error(...args)),
        logStorage.addLog('error', formatArgs(args))
      ),
    group: (options) =>
      options?.collapsed
        ? Effect.sync(() => globalThis.console.groupCollapsed(options?.label))
        : Effect.sync(() => globalThis.console.group(options?.label)),
    groupEnd: Effect.sync(() => globalThis.console.groupEnd()),
    info: (...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.info(...args)),
        logStorage.addLog('info', formatArgs(args))
      ),
    log: (...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.log(...args)),
        logStorage.addLog('info', formatArgs(args))
      ),
    table: (tabularData, properties) => Effect.sync(() => globalThis.console.table(tabularData, properties)),
    time: (label) => Effect.sync(() => globalThis.console.time(label)),
    timeEnd: (label) => Effect.sync(() => globalThis.console.timeEnd(label)),
    timeLog: (label, ...args) => Effect.sync(() => globalThis.console.timeLog(label, ...args)),
    trace: (...args) => Effect.sync(() => globalThis.console.trace(...args)),
    warn: (...args) =>
      Effect.zipRight(
        Effect.sync(() => globalThis.console.warn(...args)),
        logStorage.addLog('warn', formatArgs(args))
      ),
    unsafe: globalThis.console
  }

  return Console.setConsole(wrappedConsole)
})

// Uses Layer.unwrapEffect to build a layer that sets the Console in the FiberRef
// This makes Console.log() use our wrapped console instead of the default
export const ConsoleLogged = Layer.unwrapEffect(makeConsoleLogged)
