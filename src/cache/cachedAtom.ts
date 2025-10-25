import { Atom } from "@effect-atom/atom"
import { Duration, Layer } from "effect"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import * as Path from "@effect/platform-node/NodePath"
import { Effect, Schema } from "effect"

const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
const cacheLayer = KeyValueStore.layerFileSystem("debug").pipe(
  Layer.provide(fileSystemLayer)
)

const cacheRuntime = Atom.runtime(cacheLayer)


// /**
//  * Creates a cached atom with filesystem persistence using Effect schemas
//  *
//  * @param cacheKey - Cache key (becomes filename in debug/)
//  * @param schema - Effect Schema for type-safe serialization
//  * @param fetch - Effect that fetches the data
//  * @param ttl - Cache TTL
//  */
// export function cachedAtom<A, E, R>(
//   cacheKey: string,
//   fetch: Effect.Effect<A, E, R>,
//   schema: Schema.Schema<A, E, R>,
//   ttl: Duration.DurationInput = Duration.seconds(60)
// ) {

//   const fetchWithCache = Effect.gen(function* () {
//     const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(schema)

//     const cached = yield* schemaStore.get(cacheKey);
//     if (cached._tag === "Some") {
//       console.log(`[Cache] Hit: ${cacheKey}`)
//       return cached.value
//     }

//     console.log(`[Cache] Miss: ${cacheKey}`)
//     const fresh = yield* fetch

//     yield* schemaStore.set(cacheKey, fresh)

//     return fresh
//   })

//   return cacheRuntime.atom(fetchWithCache).pipe(
//     Atom.setIdleTTL(ttl)
//   )
// }

