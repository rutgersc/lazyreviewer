import { describe, test, expect } from "bun:test"
import { Duration, Effect, Fiber, Ref, Stream } from "effect"
import { groupedWithin } from "./groupedWithin"

describe("groupedWithin", () => {
  test("emits final partial batch when stream ends", async () => {
    const result = await Effect.runPromise(
      Stream.fromIterable([1, 2, 3, 4, 5]).pipe(
        groupedWithin(3, Duration.seconds(1)),
        Stream.runCollect
      )
    )
    expect(result.map((chunk) => Array.from(chunk)))
      .toEqual([[1, 2, 3], [4, 5]])
  })

  test("emits final partial batch after timeout on idle stream", async () => {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const ref = yield* Ref.make<Array<Array<number>>>([])
      const fiber = yield* Stream.concat(
        Stream.fromIterable([1, 2, 3, 4, 5]),
        Stream.never
      ).pipe(
        groupedWithin(3, Duration.millis(200)),
        Stream.runForEach((batch) =>
          Ref.update(ref, (batches) => [...batches, Array.from(batch)])
        ),
        Effect.forkChild
      )
      yield* Effect.sleep(Duration.seconds(2))
      const batches = yield* Ref.get(ref)
      yield* Fiber.interrupt(fiber)
      return batches
    }))
    expect(result).toEqual([[1, 2, 3], [4, 5]])
  })

  test("emits partial batch via timeout when stream goes idle (no leftover)", async () => {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const ref = yield* Ref.make<Array<Array<number>>>([])
      const fiber = yield* Stream.concat(
        Stream.fromIterable([1, 2]),
        Stream.never
      ).pipe(
        groupedWithin(5, Duration.millis(200)),
        Stream.runForEach((batch) =>
          Ref.update(ref, (batches) => [...batches, Array.from(batch)])
        ),
        Effect.forkChild
      )
      yield* Effect.sleep(Duration.seconds(1))
      const batches = yield* Ref.get(ref)
      yield* Fiber.interrupt(fiber)
      return batches
    }))
    expect(result).toEqual([[1, 2]])
  })

  test("works correctly when item count is exact multiple of chunk size", async () => {
    const result = await Effect.runPromise(
      Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(
        groupedWithin(3, Duration.seconds(1)),
        Stream.runCollect
      )
    )
    expect(result.map((chunk) => Array.from(chunk)))
      .toEqual([[1, 2, 3], [4, 5, 6]])
  })
})
