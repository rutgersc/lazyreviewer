import { Effect } from 'effect';
import { DiscussionScrollService } from '../discussion/discussion-scroll-service';
import { runWithAppServices } from '../appLayerRuntime';

export function useDiscussionScroll() {
  return {
    registerHandler: (handler: (req: { noteId: string }) => boolean) =>
      runWithAppServices(
        Effect.gen(function* () {
          const svc = yield* DiscussionScrollService
          yield* svc.register(handler)
        })
      ),
    scroll: (noteId: string) =>
      runWithAppServices(
        Effect.gen(function* () {
          const svc = yield* DiscussionScrollService
          yield* svc.scroll({ noteId })
        })
      )
  };
}
