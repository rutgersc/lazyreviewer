import { KeyValueStore, Path } from "@effect/platform"
import { Layer, DefaultServices } from "effect"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import { MergeRequestStorageLogged } from "../services/mergeRequestStorageLogged"
import { MergeRequestStorage } from "../services/mergeRequestStorage"
import { Atom } from "@effect-atom/atom-react"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer),
)

const mergeRequestStorageLayer = MergeRequestStorage.Default.pipe(
  Layer.provide(cacheLayer)
)

const mergeRequestWithLoggingLayer = MergeRequestStorageLogged.pipe(
  Layer.provide(mergeRequestStorageLayer),
  Layer.provide(Layer.succeedContext(DefaultServices.liveServices))
)

// Do not rely on Regsitry.layer: this is likely internal to atom-effect
export const appLayer = mergeRequestWithLoggingLayer
export const appAtomRuntime = Atom.runtime(appLayer)