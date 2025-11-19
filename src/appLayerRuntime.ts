import { Path } from "@effect/platform"
import { Layer, DefaultServices } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import { LogStorage } from "./logging/logStorage"
import { Atom } from "@effect-atom/atom-react"
import { ConsoleLogged } from "./logging/consoleLogged"
import { EventStorage } from "./events/events"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)

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
  eventStorageLayer
)
export const appAtomRuntime = Atom.runtime(appLayer)