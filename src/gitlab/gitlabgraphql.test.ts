import { describe, test, expect } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { MergeRequestSchema } from "../schemas/mergeRequestSchema";
import { fetchMergeRequestsEffect } from "../mergerequests/mergerequests-effects";
import { MRCacheKey } from "../store/mrCacheAtoms";
import * as KeyValueStore from "@effect/platform/KeyValueStore";
import * as FileSystem from "@effect/platform-node/NodeFileSystem";
import * as Path from "@effect/platform-node/NodePath";

describe("GitLab MR Cache Persistence", () => {
  test("should fetch MRs and persist to KeyValueStore", async () => {
    const fileSystemLayer = Layer.merge(FileSystem.layer, Path.layer);
    const cacheLayer = KeyValueStore.layerFileSystem("test-cache").pipe(
      Layer.provide(fileSystemLayer)
    );

    const key = new MRCacheKey({
      usernames: ["r.schoorstra"],
      state: "opened"
    });

    const cacheKey = "mrs_opened_r.schoorstra_gitlab";
    console.log(`[Test] Cache key: ${cacheKey}`);

    const testEffect = Effect.gen(function* () {
      const schemaStore = (yield* KeyValueStore.KeyValueStore).forSchema(
        Schema.Array(MergeRequestSchema)
      );

      console.log(`[Test] Fetching MRs...`);
      const fresh = yield* fetchMergeRequestsEffect(key);
      console.log(`[Test] Fetched ${fresh.length} MRs`);

      expect(fresh.length).toBeGreaterThan(0);

      console.log(`[Test] Writing ${fresh.length} MRs to cache key: ${cacheKey}`);
      yield* schemaStore.set(cacheKey, fresh).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            console.error(`[Test] Error writing to cache:`, error);
          })
        ),
        Effect.tap(() =>
          Effect.sync(() => {
            console.log(`[Test] Successfully wrote to: ${cacheKey}`);
          })
        )
      );

      console.log(`[Test] Reading back from cache...`);
      const cached = yield* schemaStore.get(cacheKey);
      if (cached._tag === "None") {
        throw new Error("Cache read failed - no data found");
      }

      console.log(`[Test] Cache read successful, got ${cached.value.length} MRs`);
      expect(cached.value.length).toBe(fresh.length);

      cached.value.forEach((mr) => {
        mr.pipeline.stage.forEach((stage) => {
          stage.jobs.forEach((job) => {
            expect(typeof job.localId).toBe("number");
          });
        });
      });

      return cached.value;
    });

    const result = await Effect.runPromise(testEffect.pipe(Effect.provide(cacheLayer)));
    console.log(`\n[Test] Test completed successfully with ${result.length} MRs`);
  });
});