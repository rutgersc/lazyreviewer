/**
 * Minimal working example: yielding multiple values from a repeating stream iteration
 *
 * This demonstrates how to emit multiple BackgroundSyncStatus values per iteration:
 * 1. "syncing" status BEFORE the fetch starts
 * 2. "syncPerformed" status AFTER the fetch completes
 */

import { Effect, Stream, Queue, Option } from 'effect';

type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextRefreshDate: Date }
  | { _tag: 'syncing' }
  | { _tag: 'syncPerformed' }
  | { _tag: 'syncDisabled' };

/**
 * APPROACH 1: Stream.flatMap with array (statuses emitted together at end)
 *
 * Simplest approach, but all statuses are emitted AFTER the iteration completes.
 * Good when you don't need real-time status updates during the operation.
 */
const approach1_flatMapArray = () => {
  const backgroundCheck = Effect.gen(function* () {
    const shouldFetch = true; // simplified

    if (!shouldFetch) {
      yield* Effect.sleep('5 seconds');
      return [{ _tag: 'syncDisabled' } as BackgroundSyncStatus];
    }

    const statuses: BackgroundSyncStatus[] = [];

    // Collect "syncing" status (but won't emit until array is returned)
    statuses.push({ _tag: 'syncing' });

    // Simulate fetch
    yield* Effect.sleep('1 second');
    yield* Effect.logInfo('Fetch completed');

    // Collect "syncPerformed" status
    statuses.push({ _tag: 'syncPerformed' });

    yield* Effect.sleep('5 seconds');
    return statuses;
  });

  return Stream.repeatEffect(backgroundCheck).pipe(
    Stream.flatMap(statuses => Stream.fromIterable(statuses))
  );
};

/**
 * APPROACH 2: Queue-based (real-time emission)
 *
 * Uses a Queue to emit statuses in real-time as they happen.
 * "syncing" is emitted BEFORE fetch, "syncPerformed" AFTER.
 */
const approach2_queue = () => {
  return Stream.unwrap(
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<BackgroundSyncStatus>();

      // Background worker that pushes statuses to queue
      const worker = Effect.gen(function* () {
        while (true) {
          const shouldFetch = true; // simplified

          if (!shouldFetch) {
            yield* Queue.offer(queue, { _tag: 'syncDisabled' });
            yield* Effect.sleep('30 seconds');
            continue;
          }

          // Emit "syncing" BEFORE fetch
          yield* Queue.offer(queue, { _tag: 'syncing' });

          // Simulate fetch
          yield* Effect.sleep('1 second');
          yield* Effect.logInfo('Fetch completed');

          // Emit "syncPerformed" AFTER fetch
          yield* Queue.offer(queue, { _tag: 'syncPerformed' });

          yield* Effect.sleep('5 seconds');
        }
      }).pipe(Effect.forkScoped);

      // Start worker and return stream from queue
      yield* worker;
      return Stream.fromQueue(queue);
    }).pipe(Effect.scoped)
  );
};

/**
 * APPROACH 3: Stream.asyncPush (cleanest for push-based emission)
 *
 * Uses the emit callback to push statuses in real-time.
 */
const approach3_asyncPush = () => {
  return Stream.asyncPush<BackgroundSyncStatus>((emit) =>
    Effect.gen(function* () {
      while (true) {
        const shouldFetch = true; // simplified

        if (!shouldFetch) {
          emit.single({ _tag: 'syncDisabled' });
          yield* Effect.sleep('30 seconds');
          continue;
        }

        // Emit "syncing" BEFORE fetch
        emit.single({ _tag: 'syncing' });

        // Simulate fetch
        yield* Effect.sleep('1 second');
        yield* Effect.logInfo('Fetch completed');

        // Emit "syncPerformed" AFTER fetch
        emit.single({ _tag: 'syncPerformed' });

        yield* Effect.sleep('5 seconds');
      }
    })
  );
};

/**
 * APPROACH 4: Stream.unfoldEffect (functional iteration)
 *
 * Each unfold step can return multiple values via Stream.flatMap.
 * State is threaded through iterations. Uses Option.some for infinite iteration.
 */
const approach4_unfoldEffect = () => {
  type State = { iteration: number };

  const step = (state: State): Effect.Effect<Option.Option<readonly [BackgroundSyncStatus[], State]>> =>
    Effect.gen(function* () {
      const shouldFetch = true; // simplified

      if (!shouldFetch) {
        yield* Effect.sleep('30 seconds');
        return Option.some([[{ _tag: 'syncDisabled' } as BackgroundSyncStatus], state] as const);
      }

      // Build array of statuses to emit
      const statuses: BackgroundSyncStatus[] = [{ _tag: 'syncing' }];

      // Simulate fetch
      yield* Effect.sleep('1 second');
      yield* Effect.logInfo(`Fetch ${state.iteration} completed`);

      statuses.push({ _tag: 'syncPerformed' });

      yield* Effect.sleep('5 seconds');
      return Option.some([statuses, { iteration: state.iteration + 1 }] as const);
    });

  return Stream.unfoldEffect({ iteration: 0 }, step).pipe(
    Stream.flatMap(statuses => Stream.fromIterable(statuses))
  );
};

// Export for testing
export {
  approach1_flatMapArray,
  approach2_queue,
  approach3_asyncPush,
  approach4_unfoldEffect,
  type BackgroundSyncStatus
};