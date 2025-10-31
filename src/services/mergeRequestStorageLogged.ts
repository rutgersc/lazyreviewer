import { Layer, Effect, Console as ConsoleI } from "effect";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import { MergeRequestStorage } from "./mergeRequestStorage";

export const MergeRequestStorageLogged = Layer.effect(
  MergeRequestStorage,
  Effect.gen(function* () {
    const storage = yield* MergeRequestStorage
    const Console = yield* ConsoleI.Console

    const get = (key: string) =>
      Effect.gen(function* () {
        yield* Console.log(`[MRStorage] get: ${key}`);
        return yield* storage.get(key);
      });

    const set = (key: string, value: readonly MergeRequest[]) =>
      Effect.gen(function* () {
        yield* Console.log(`[MRStorage] set: ${key}`);
        return yield* storage.set(key, value);
      });

    const invalidate = (key: string) =>
      Effect.gen(function* () {
        yield* Console.log(`[MRStorage] invalidate: ${key}`);
        return yield* storage.invalidate(key);
      });

    return new MergeRequestStorage({
      get: get,
      set: set,
      invalidate: invalidate,
    })
  })
)