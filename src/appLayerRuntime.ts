import { Path } from "@effect/platform"
import { Layer, DefaultServices, Effect, Runtime, Scope } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import * as CommandExecutor from "@effect/platform-node/NodeCommandExecutor"
import { LogStorage } from "./logging/logStorage"
import { Atom } from "@effect-atom/atom-react"
import { ConsoleLogged } from "./logging/consoleLogged"
import { EventStorage } from "./events/events"
import { JiraScrollService } from "./jira/jira-scroll-service"
import { DiscussionScrollService } from "./discussion/discussion-scroll-service"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const commandExecutorLayer = CommandExecutor.layer.pipe(
  Layer.provide(fileSystemLayer)
)

const logStorageLayer = LogStorage.Default.pipe(
  Layer.provide(fileSystemLayer)
)

export const consoleLoggedLayer = ConsoleLogged.pipe(
  Layer.provide(logStorageLayer),
  Layer.provide(Layer.succeedContext(DefaultServices.liveServices))
)

const eventStorageLayer = EventStorage.Default.pipe(
  Layer.provide(fileSystemLayer),
  Layer.provide(consoleLoggedLayer)
)

// Do not rely on Registry.layer: this is likely internal to atom-effect
export const appLayer = Layer.mergeAll(
  consoleLoggedLayer,
  logStorageLayer,
  eventStorageLayer,
  fileSystemLayer,
  commandExecutorLayer,
  JiraScrollService.Default,
  DiscussionScrollService.Default
)

// Build a shared runtime using the atom system's memoMap
// This ensures services are shared between atoms and standalone effects
type AppLayerContext = Layer.Layer.Success<typeof appLayer>
let _appRuntimePromise: Promise<Runtime.Runtime<AppLayerContext>> | undefined
const buildRuntime = Effect.gen(function* () {
  const scope = yield* Scope.make()
  const context = yield* Layer.buildWithMemoMap(appLayer, Atom.runtime.memoMap, scope)
  return Runtime.make({
    context,
    fiberRefs: Runtime.defaultRuntime.fiberRefs,
    runtimeFlags: Runtime.defaultRuntime.runtimeFlags
  })
})

export const getAppRuntime = (): Promise<Runtime.Runtime<AppLayerContext>> => {
  if (!_appRuntimePromise) {
    _appRuntimePromise = Effect.runPromise(buildRuntime)
  }
  return _appRuntimePromise
}

// Atom runtime - shares services via the same memoMap
export const appAtomRuntime = Atom.runtime(appLayer)