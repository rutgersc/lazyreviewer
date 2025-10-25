import { Atom } from "@effect-atom/atom"
import { Duration, Layer } from "effect"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import * as Path from "@effect/platform-node/NodePath"
import { ManagedRuntime } from "effect"
import { MergeRequestSchema, PipelineJobSchema } from "../schemas/mergeRequestSchema"
import { Effect, Schema } from "effect"

/**
 * Creates a cached atom with filesystem persistence using Effect schemas
 *
 * @param cacheKey - Cache key (becomes filename in debug/)
 * @param schema - Effect Schema for type-safe serialization
 * @param fetch - Effect that fetches the data
 * @param ttl - Cache TTL
 */
export function cachedAtom<A, E, R>(
  cacheKey: string,
  fetch: Effect.Effect<A, E, R>,
  ttl: Duration.DurationInput = Duration.seconds(60)
): Effect {
  const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer)
  const layer = KeyValueStore.layerFileSystem("debug").pipe(
    Layer.provide(fileSystemLayer)
  )

  const runtime = ManagedRuntime.make(layer)

  const fetchWithCache = Effect.gen(function* () {
    const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(MergeRequestSchema)

    const cached = yield* schemaStore.get(cacheKey);
    if (cached._tag === "Some") {
      console.log(`[Cache] Hit: ${cacheKey}`)
      return cached.value
    }

    console.log(`[Cache] Miss: ${cacheKey}`)
    const fresh = yield* fetch

    yield* schemaStore.set(cacheKey, fresh)

    return fresh
  })

  const wtf = Atom.make((get) => fetchWithCache);
  const uhh = Atom.make(() => fetchWithCache);

  return uhh.pipe(
    Atom.setIdleTTL(ttl)
  )
}



const wr =
  Effect.gen(function* () {
    yield* Effect.sleep(Duration.millis(600))
    return 1
  });
const booksCountAtom = Atom.make((get) => wr)