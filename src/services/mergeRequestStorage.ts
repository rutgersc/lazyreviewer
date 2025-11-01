import { KeyValueStore } from "@effect/platform"
import { Console, Effect, Layer, Schema } from "effect"
import { MergeRequestSchema, type MergeRequest } from "../schemas/mergeRequestSchema"

export class MergeRequestStorage extends Effect.Service<MergeRequestStorage>()("MergeRequestStorage", {
  accessors: true,
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

export const MergeRequestStorageLogged = Layer.effect(
  MergeRequestStorage,
  Effect.gen(function* () {
    const storage = yield* MergeRequestStorage
    const consoleService = yield* Console.Console

    const get = Effect.fn(function* (key: string) {
      yield* consoleService.log("[MergeRequestStorage] get ", key)
      return yield* storage.get(key);
    });

    const set = Effect.fn(function* (key: string, value: readonly MergeRequest[]) {
      yield* consoleService.log("[MergeRequestStorage] set ", key)
      return yield* storage.set(key, value);
    });

    const invalidate = Effect.fn(function* (key: string) {
      yield* consoleService.log("[MergeRequestStorage] set ", key)
      return yield* storage.invalidate(key);
    });

    return {
      ...storage,
      get: get,
      set: set,
      invalidate
    } as const;
  })
)
