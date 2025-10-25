import { Atom } from "@effect-atom/atom"
import { Effect, Duration, Layer } from "effect"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as FileSystem from "@effect/platform-node/NodeFileSystem"
import type * as Schema from "@effect/schema/Schema"

/**
 * Creates a cached atom with filesystem persistence using Effect schemas
 *
 * @param cacheKey - Cache key (becomes filename in debug/)
 * @param schema - Effect Schema for type-safe serialization
 * @param fetch - Effect that fetches the data
 * @param ttl - Cache TTL
 */
export function cachedAtom<A, I, R>(
  cacheKey: string,
  schema: Schema.Schema<A, I, R>,
  fetch: Effect.Effect<A, unknown, never>,
  ttl: Duration.DurationInput = Duration.seconds(60)
) {
  const layer = Layer.provide(
    KeyValueStore.layerFileSystem("debug"),
    FileSystem.layer
  )

  const runtime = Atom.runtime(layer)

  const fetchWithCache = Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore

    const schemaStore = store.forSchema(schema)

    const cached = yield* Effect.option(schemaStore.get(cacheKey))

    if (cached._tag === "Some") {
      console.log(`[Cache] Hit: ${cacheKey}`)
      return cached.value
    }

    console.log(`[Cache] Miss: ${cacheKey}`)
    const fresh = yield* fetch

    yield* schemaStore.set(cacheKey, fresh)

    return fresh
  })

  return runtime.atom(fetchWithCache).pipe(
    Atom.setIdleTTL(ttl)
  )
}
