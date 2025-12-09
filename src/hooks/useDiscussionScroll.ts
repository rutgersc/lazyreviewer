import { useMemo } from 'react';
import { Runtime } from 'effect';
import { DiscussionScrollService } from '../discussion/discussion-scroll-service';
import { getAppRuntime } from '../appLayerRuntime';

export function useDiscussionScroll() {
  return useMemo(() => ({
    // Handler should return true if it successfully scrolled, false otherwise
    registerHandler: (handler: (req: { noteId: string }) => boolean) =>
      getAppRuntime().then(runtime => Runtime.runPromise(runtime)(DiscussionScrollService.register(handler))),
    scroll: (noteId: string) =>
      getAppRuntime().then(runtime => Runtime.runPromise(runtime)(DiscussionScrollService.scroll({ noteId })))
  }), []);
}
