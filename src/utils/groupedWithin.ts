import { Cause, Duration, Effect, Queue, Stream } from "effect"

/**
 * Workaround for Effect v4 beta bug where Stream.groupedWithin drops
 * the final partial batch when upstream ends or goes idle.
 *
 * Queue-based: producer pushes tagged signals, timer pushes ticks,
 * consumer batches items and flushes on size/tick/done.
 */
export const groupedWithin = (chunkSize: number, duration: Duration.Input) =>
  <A, E, R>(self: Stream.Stream<A, E, R>): Stream.Stream<Array<A>, E, R> => {
    type Signal =
      | { readonly _tag: "item"; readonly value: A }
      | { readonly _tag: "tick" }
      | { readonly _tag: "done"; readonly error?: Cause.Cause<E> }

    return Stream.unwrap(Effect.gen(function*() {
      const queue = yield* Queue.unbounded<Signal>()

      // Producer: push items, then signal done (with optional error cause)
      yield* self.pipe(
        Stream.runForEach((a) => Queue.offer(queue, { _tag: "item", value: a })),
        Effect.matchCauseEffect({
          onFailure: (cause) => Queue.offer(queue, { _tag: "done", error: cause }),
          onSuccess: () => Queue.offer(queue, { _tag: "done" })
        }),
        Effect.forkScoped
      )

      // Timer: push tick at interval
      yield* Effect.sleep(duration).pipe(
        Effect.andThen(Queue.offer(queue, { _tag: "tick" })),
        Effect.forever,
        Effect.forkScoped
      )

      // Consumer: pull signals, batch items, flush on size/tick/done
      return Stream.unfold([] as Array<A> | null, (state) =>
        Effect.gen(function*() {
          if (state === null) return undefined
          let batch = state
          while (true) {
            const signal = yield* Queue.take(queue)
            switch (signal._tag) {
              case "done":
                if (signal.error) return yield* Effect.failCause(signal.error)
                return batch.length > 0 ? [batch, null] as const : undefined
              case "tick":
                if (batch.length > 0) return [batch, []] as const
                continue
              case "item": {
                const next = [...batch, signal.value]
                if (next.length >= chunkSize) return [next, []] as const
                batch = next
              }
            }
          }
        })
      )
    }))
  }
