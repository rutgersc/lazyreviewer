import { Effect } from 'effect';
import { JiraScrollService } from '../jira/jira-scroll-service';
import { runWithAppServices } from '../appLayerRuntime';

export function useJiraScroll() {
  return {
    registerHandler: (handler: (req: { issueKey: string; commentId?: string }) => void) =>
      runWithAppServices(
        Effect.gen(function* () {
          const svc = yield* JiraScrollService
          yield* svc.register(handler)
        })
      ),
    scroll: (issueKey: string, commentId?: string) =>
      runWithAppServices(
        Effect.gen(function* () {
          const svc = yield* JiraScrollService
          yield* svc.scroll({ issueKey, ...(commentId !== undefined && { commentId }) })
        })
      )
  }
}
