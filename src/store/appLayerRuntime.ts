import { KeyValueStore, Path } from "@effect/platform"
import { Layer, DefaultServices } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import { MergeRequestStorageLogged } from "../services/mergeRequestStorageLogged"
import { MergeRequestStorage } from "../services/mergeRequestStorage"
import { LogStorage } from "../services/logStorage"
import { ConsoleLogged } from "../services/consoleLogged"
import { Atom } from "@effect-atom/atom-react"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer),
)

const mergeRequestStorageLayer = MergeRequestStorage.Default.pipe(
  Layer.provide(cacheLayer)
)

const logStorageLayer = LogStorage.Default.pipe(
  Layer.provide(fileSystemLayer)
)

export const consoleLoggedLayer = ConsoleLogged.pipe(
  Layer.provide(logStorageLayer),
  Layer.provide(Layer.succeedContext(DefaultServices.liveServices))
)

const mergeRequestWithLoggingLayer = MergeRequestStorageLogged.pipe(
  Layer.provideMerge(mergeRequestStorageLayer),
  Layer.provideMerge(consoleLoggedLayer) // Use wrapped console
)

// Merge logStorageLayer into the final app layer so LogStorage is available
const appLayerWithLogging = Layer.merge(
  mergeRequestWithLoggingLayer,
  logStorageLayer
)

// Do not rely on Regsitry.layer: this is likely internal to atom-effect
export const appLayer = appLayerWithLogging
export const appAtomRuntime = Atom.runtime(appLayer)