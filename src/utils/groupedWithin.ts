import { Array as Arr, Cause, Duration, Effect, Exit, Latch, Option, Queue, Schedule, Scope, Sink, Stream } from "effect"
import * as Channel from "effect/Channel"
import * as Pull from "effect/Pull"

/**
 * Patched copy of Effect v4's aggregateWithin (effect@4.0.0-beta.42).
 *
 * Bug: when the sink consumed leftover data from a previous cycle but then
 * got a halt from the buffer, `hadChunk` was false (it only tracks upstream
 * pushes) so the final partial batch was dropped.
 *
 * Fix: track `consumedLeftover` separately — one new boolean checked in
 * both the schedule guard and catchSinkHalt.
 */
const aggregateWithin = <A, E, R, B, A2, E2, R2, C, E3, R3>(
  self: Stream.Stream<A, E, R>,
  sink: Sink.Sink<B, A | A2, A2, E2, R2>,
  schedule: Schedule.Schedule<C, Option.Option<B>, E3, R3>
): Stream.Stream<B, E | E2 | E3, R | R2 | R3> =>
  // Stream.ts:8068 — fromChannel(Channel.fromTransformBracket(Effect.fnUntraced(function*(...) {
  Stream.fromChannel(Channel.fromTransformBracket(Effect.fnUntraced(
    function*(_upstream: Pull.Pull<unknown, unknown, unknown>, _: Scope.Scope, scope: Scope.Scope) {
      // Stream.ts:8069
      const pull = yield* Channel.toPullScoped(self.channel, _)

      // Stream.ts:8071-8075
      const pullLatch = Latch.makeUnsafe(false)
      const scheduleStep = Symbol()
      const buffer = yield* Queue.make<Arr.NonEmptyReadonlyArray<A> | typeof scheduleStep, E | Cause.Done<void>>({
        capacity: 0
      })

      // Stream.ts:8077-8089 — upstream -> buffer
      let hadChunk = false
      yield* pull.pipe(
        pullLatch.whenOpen,
        Effect.flatMap((arr) => {
          hadChunk = true
          pullLatch.closeUnsafe()
          return Queue.offer(buffer, arr)
        }),
        Effect.forever, // Stream.ts:8086 — don't disable autoYield to prevent choking the schedule
        Effect.catchCause((cause) => Queue.failCause(buffer, cause)),
        Effect.forkIn(scope)
      )

      // Stream.ts:8091-8101 — schedule -> buffer
      let lastOutput = Option.none<B>()
      let leftover: Arr.NonEmptyReadonlyArray<A2> | undefined
      let consumedLeftover = false // BUG FIX: tracks leftover consumed this sink cycle
      const step = yield* Schedule.toStepWithSleep(schedule)
      const stepToBuffer = Effect.suspend(function loop(): Pull.Pull<never, E3, void, R3> {
        // Stream.ts:8096-8100
        return step(lastOutput).pipe(
          // BUG FIX: also check consumedLeftover — leftover counts as data to flush
          // Stream.ts:8097 (original: `!hadChunk && leftover === undefined`)
          Effect.flatMap(() => !hadChunk && !consumedLeftover && leftover === undefined ? loop() : Queue.offer(buffer, scheduleStep)),
          Effect.flatMap(() => Effect.never),
          Pull.catchDone(() => Cause.done())
        )
      })

      // Stream.ts:8103-8108 — buffer -> sink
      const pullFromBuffer: Pull.Pull<
        Arr.NonEmptyReadonlyArray<A>,
        E
      > = Queue.take(buffer).pipe(
        Effect.flatMap((arr) => arr === scheduleStep ? Cause.done() : Effect.succeed(arr))
      )

      // Stream.ts:8111-8120
      const sinkUpstream = Effect.suspend((): Pull.Pull<Arr.NonEmptyReadonlyArray<A | A2>, E> => {
        if (leftover !== undefined) {
          const chunk = leftover
          leftover = undefined
          consumedLeftover = true // BUG FIX: track that this cycle got data from leftover
          return Effect.succeed(chunk)
        }
        // Stream.ts:8117-8119
        hadChunk = false
        pullLatch.openUnsafe()
        return pullFromBuffer
      })

      // Stream.ts:8121-8127
      const catchSinkHalt = Effect.flatMap(([value, leftover_]: Sink.End<B, A2>) => {
        // Stream.ts:8122-8123 — ignore the last output if the upstream only pulled a halt
        // BUG FIX: also check consumedLeftover — leftover counts as data
        // (original: `!hadChunk && buffer.state._tag === "Done"`)
        if (!hadChunk && !consumedLeftover && buffer.state._tag === "Done") return Cause.done()
        consumedLeftover = false
        // Stream.ts:8124-8126
        lastOutput = Option.some(value)
        leftover = leftover_
        return Effect.succeed(Arr.of(value))
      })

      // Stream.ts:8129-8137
      return Effect.suspend(() => {
        // Stream.ts:8130-8132 — if the buffer has exited and there is no more data to process
        if (buffer.state._tag === "Done") {
          return buffer.state.exit as Exit.Exit<never, Cause.Done<void> | E> // Stream.ts:8132 — original cast
        }
        // Stream.ts:8134 — `as any` is in the original: sink.transform(sinkUpstream as any, scope)
        return Effect.succeed(Effect.suspend(() => sink.transform(sinkUpstream as any, scope)))
      }).pipe(
        // Stream.ts:8136
        Effect.flatMap((pull) => Effect.raceFirst(catchSinkHalt(pull), stepToBuffer))
      )
    }
  ))) as any // widening needed: fromTransformBracket return type doesn't carry R through

/**
 * Workaround for Effect v4 beta bug where Stream.groupedWithin drops
 * the final partial batch when upstream ends or goes idle.
 *
 * Patched copy of the real implementation with consumedLeftover fix.
 * Source: vendor/effect-smol/packages/effect/src/Stream.ts:7644-7659
 */
export const groupedWithin = (chunkSize: number, duration: Duration.Input) =>
  <A, E, R>(self: Stream.Stream<A, E, R>): Stream.Stream<Array<A>, E, R> =>
    aggregateWithin(self, Sink.take(chunkSize), Schedule.spaced(duration))
