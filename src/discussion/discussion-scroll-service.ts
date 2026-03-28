import { Effect, ServiceMap, Option, Ref, Deferred, Duration, Schedule } from "effect";

type ScrollRequest = { noteId: string };
// Handler returns true if it successfully found and scrolled to the discussion
type Handler = (req: ScrollRequest) => boolean;

export class DiscussionScrollService extends ServiceMap.Service<DiscussionScrollService>()("DiscussionScrollService", {
  make: Effect.gen(function* () {
    const handlerRef = yield* Ref.make<Option.Option<Handler>>(Option.none());
    const handlerReady = yield* Deferred.make<void>();

    const register = (handler: Handler) =>
      Effect.gen(function* () {
        yield* Ref.set(handlerRef, Option.some(handler));
        yield* Deferred.succeed(handlerReady, void 0);
      });

    const scroll = (req: ScrollRequest) =>
      Effect.gen(function* () {
        // Wait for handler to be registered
        yield* Deferred.await(handlerReady);

        // Retry until handler returns success (MR data is ready)
        let attempt = 0;
        const tryScroll = Effect.gen(function* () {
          attempt++;
          const maybe = yield* Ref.get(handlerRef);
          if (Option.isSome(maybe)) {
            const success = yield* Effect.sync(() => maybe.value(req));
            console.log(`[DiscussionScroll] attempt ${attempt} for noteId=${req.noteId}: ${success ? 'success' : 'not found'}`);
            return success;
          }
          console.log(`[DiscussionScroll] attempt ${attempt}: no handler registered`);
          return false;
        });

        // Retry with short delay, up to ~500ms total
        yield* tryScroll.pipe(
          Effect.repeat(
            Schedule.recurWhile((success: boolean) => !success).pipe(
              Schedule.intersect(Schedule.recurs(30)),
              Schedule.addDelay(() => Duration.millis(16))
            )
          )
        );
      });

    return { register, scroll } as const;
  })
}) {}
