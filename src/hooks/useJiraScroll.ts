import { useMemo } from 'react';
import { Runtime } from 'effect';
import { JiraScrollService } from '../jira/jira-scroll-service';
import { getAppRuntime } from '../appLayerRuntime';

export function useJiraScroll() {
  // useMemo(() => ({
  return {
    registerHandler: (handler: (req: { issueKey: string; commentId?: string }) => void) =>
      getAppRuntime().then(runtime => Runtime.runPromise(runtime)(JiraScrollService.register(handler))),
    scroll: (issueKey: string, commentId?: string) =>
      getAppRuntime().then(runtime => Runtime.runPromise(runtime)(JiraScrollService.scroll({ issueKey, commentId })))
  }
}
