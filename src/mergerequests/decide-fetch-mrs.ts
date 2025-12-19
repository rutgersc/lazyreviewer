import { Effect, Data, Console } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import { EventStorage } from "../events/events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlab-graphql"
import type { SearchJiraIssuesError } from "../jira/jira-service"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent } from "../gitlab/gitlab-graphql"
import { loadJiraTicketsAsEvent } from "../jira/jira-service"
import { projectGitlabProjectMrsFetchedEvent, projectGitlabUserMrsFetchedEvent } from "../gitlab/gitlab-projections"
import { OpenMrsTrackingState } from "./mr-diff-tracking"

export class MRCacheKey extends Data.TaggedClass("UserMRs")<{
  readonly usernames: readonly string[]
  readonly state: MergeRequestState
}> {}

export class ProjectMRCacheKey extends Data.TaggedClass("ProjectMRs")<{
  readonly projectPath: string
  readonly state: MergeRequestState
}> {}

export type CacheKey = MRCacheKey | ProjectMRCacheKey

export type MergeRequestsCacheError =
  | string
  | FetchGitlabMrsError
  | FetchGitlabProjectMrsError
  | SearchJiraIssuesError
  | BitbucketCredentialsNotConfiguredError
  | FetchBitbucketPrsError
  | BitbucketPrsJsonParseError
  | PlatformError
  | ParseError

export const decideFetchUserMrs = (
  usernames: string[],
  state: MergeRequestState,
  options?: {
    trackingState: OpenMrsTrackingState,
    resolveMrInfo: (id: string) => { projectPath: string, iid: string } | undefined
  }
): Effect.Effect<
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  const mrEvent = yield* getGitlabMrsAsEvent(usernames, state)
  yield* EventStorage.appendEvent(mrEvent)

  // Fetch Jira events
  const gitlabMrs = projectGitlabUserMrsFetchedEvent(mrEvent)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)
})

export const decideFetchProjectMrs = (
  projectPath: string,
  state: MergeRequestState,
  options?: {
    trackingState: OpenMrsTrackingState,
    resolveMrInfo: (id: string) => { projectPath: string, iid: string } | undefined
  }
): Effect.Effect<
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  // Fetch new MR event
  const mrEvent = yield* getGitlabMrsByProjectAsEvent(projectPath, state);

  yield* EventStorage.appendEvent(mrEvent)

  // Fetch Jira events
  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)
})
