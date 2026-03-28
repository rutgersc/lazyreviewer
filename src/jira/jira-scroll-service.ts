import { Effect, ServiceMap, Option, Ref } from "effect";

type ScrollRequest = { issueKey: string; commentId?: string };
type Handler = (req: ScrollRequest) => void;

export class JiraScrollService extends ServiceMap.Service<JiraScrollService>()("JiraScrollService", {
  make: Effect.gen(function* () {
    const handlerRef = yield* Ref.make<Option.Option<Handler>>(Option.none());

    const register = (handler: Handler) =>
      Effect.gen(function* () {
        yield* Ref.set(handlerRef, Option.some(handler));
      });

    const scroll = (req: ScrollRequest) =>
      Effect.gen(function* () {
        const maybe = yield* Ref.get(handlerRef);
        if (Option.isSome(maybe)) {
          yield* Effect.sync(() => maybe.value(req));
        }
      });

    return { register, scroll } as const;
  })
}) {}

