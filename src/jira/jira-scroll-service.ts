import { Effect, ServiceMap, Option, Ref, Deferred, Duration, Schedule } from "effect";

type ScrollRequest = { issueKey: string; commentId?: string };
// Handler returns true if it found the issue/comment and scrolled to it
type Handler = (req: ScrollRequest) => boolean;

export class JiraScrollService extends ServiceMap.Service<JiraScrollService>()("JiraScrollService", {
  make: Effect.gen(function* () {
    const handlerRef = yield* Ref.make<Option.Option<Handler>>(Option.none());
    const handlerReady = yield* Deferred.make<void>();

    const register = (handler: Handler) =>
      Effect.gen(function* () {
        yield* Ref.set(handlerRef, Option.some(handler));
        yield* Deferred.succeed(handlerReady, void 0);
      });

    // The Overview registers the handler, and it only mounts while its tab is active — so a jump
    // that switches tabs has to wait for that mount, then for the MR's Jira data to arrive.
    const scroll = (req: ScrollRequest) =>
      Effect.gen(function* () {
        yield* Deferred.await(handlerReady);

        const tryScroll = Effect.gen(function* () {
          const maybe = yield* Ref.get(handlerRef);
          return Option.isSome(maybe)
            ? yield* Effect.sync(() => maybe.value(req))
            : false;
        });

        yield* tryScroll.pipe(
          Effect.repeat(
            Schedule.identity<boolean>().pipe(
              Schedule.while(m => !m.output),
              Schedule.both(Schedule.recurs(30)),
              Schedule.addDelay(() => Effect.succeed(Duration.millis(16)))
            )
          )
        );
      });

    return { register, scroll } as const;
  })
}) {}
