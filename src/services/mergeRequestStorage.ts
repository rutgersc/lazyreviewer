import { KeyValueStore } from "@effect/platform"
import { Effect, Schema } from "effect"
import { MergeRequestSchema, type MergeRequest } from "../schemas/mergeRequestSchema"

export class MergeRequestStorage extends Effect.Service<MergeRequestStorage>()("MergeRequestStorage", {
  effect: Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const schemaStore = store.forSchema(Schema.Array(MergeRequestSchema))

    return {
      get: (key: string) => schemaStore.get(key),
      set: (key: string, value: readonly MergeRequest[]) => schemaStore.set(key, value),
      invalidate: (key: string) => schemaStore.remove(key)
    } as const
  })
}) {}
