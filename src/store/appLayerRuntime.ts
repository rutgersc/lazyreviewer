import { KeyValueStore, Path } from "@effect/platform"
import { Layer, DefaultServices, Context, Console } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import { MergeRequestStorageLogged } from "../mergerequests/mergeRequestStorageLogged"
import { LogStorage } from "../logging/logStorage"
import { Atom } from "@effect-atom/atom-react"
import { ConsoleLogged } from "../logging/consoleLogged"
import { MergeRequestStorage } from "../mergerequests/mergeRequestStorage"
import { EventStorage } from "../events/events"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer),
)

const logStorageLayer = LogStorage.Default.pipe(
  Layer.provide(fileSystemLayer)
)

const eventStorageLayer = EventStorage.Default.pipe(
  Layer.provide(fileSystemLayer)
)

export const consoleLoggedLayer = ConsoleLogged.pipe(
  Layer.provide(logStorageLayer),
  Layer.provide(Layer.succeedContext(DefaultServices.liveServices))
)

const MergeRequestStorageLoggedLayer2 = MergeRequestStorageLogged.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      MergeRequestStorage.Default.pipe(Layer.provide(cacheLayer)),
      consoleLoggedLayer)),
);

// Do not rely on Regsitry.layer: this is likely internal to atom-effect
export const appLayer = Layer.mergeAll(
  MergeRequestStorageLoggedLayer2,
  logStorageLayer,
  eventStorageLayer
)
export const appAtomRuntime = Atom.runtime(appLayer)