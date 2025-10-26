import { Layer, Effect, Console } from "effect";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import { MergeRequestStorage } from "./mergeRequestStorage";

export const MergeRequestStorageLogged = Layer.effect(
  MergeRequestStorage,
  Effect.gen(function* () {
    const storage = yield* MergeRequestStorage
    const console = yield* Console.Console

    const get = (key: string) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] get: ${key}`);
        return yield* storage.get(key);
      });

    const set = (key: string, value: readonly MergeRequest[]) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] set: ${key}`);
        return yield* storage.set(key, value);
      });

    const invalidate = (key: string) =>
      Effect.gen(function* () {
        yield* console.log(`[MRStorage] invalidate: ${key}`);
        return yield* storage.invalidate(key);
      });

    return new MergeRequestStorage({
      get: get,
      set: set,
      invalidate: invalidate,
    })
  })
)