import { Effect, Data, Console, Context } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import { type MergeRequest } from "./mergeRequestSchema"
import { fetchMergeRequestsByProject, fetchMergeRequests } from "./mergerequests-effects"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import { MergeRequestStorage } from "./mergeRequestStorage"
import { EventStorage } from "../events/events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlabgraphql"
import type { SearchJiraIssuesError } from "../jira/jiraService"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent, projectGitlabUserMrsFetchedEvent, projectGitlabProjectMrsFetchedEvent } from "../gitlab/gitlabgraphql"
import { loadJiraTickets } from "../jira/jiraService"

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

const toCacheKeyString = (key: MRCacheKey): string => {
  const usernamesStr = key.usernames.join('_')
  return `mrs_${key.state}_${usernamesStr}_gitlab`
}

const toProjectCacheKeyString = (key: ProjectMRCacheKey): string => {
  const fixedProject = key.projectPath
    .replace(/:/g, '_')
    .replace(/\//g, '_')
  return `mrs_${key.state}_${fixedProject}_gitlab`
}


export const fetchUserMRsWithCache = (key: MRCacheKey): Effect.Effect<
  { data: readonly MergeRequest[], timestamp: Date | null },
  MergeRequestsCacheError,
  MergeRequestStorage | EventStorage
> => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  const eventStorage = yield* EventStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}, ${cached.value.data[0]?.targetbranch}`)
    return { data: cached.value.data, timestamp: cached.value.timestamp };
  }

  yield* Console.log(`[Cache] MISS: ${cacheKey}`)

  // Fetch and create event
  const event = yield* getGitlabMrsAsEvent(key.usernames as string[], key.state)

  // Append to event log (dual-write)
  yield* eventStorage.appendEvent(event)
  yield* Console.log(`[Event] Appended: ${event.type} for users ${event.forUsernames.join(', ')}`)

  // Process event to get normalized MRs (same logic as getGitlabMrs)
  const gitlabMrs = projectGitlabUserMrsFetchedEvent(event)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap((mr) => mr.jiraIssueKeys)))
  const tickets = yield* loadJiraTickets(jiraKeys)

  const fresh = gitlabMrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  yield* storage.set(cacheKey, fresh);
  return { data: fresh, timestamp: new Date() }
})

const test = MergeRequestStorage.get("test");

export const fetchProjectMRsWithCache = (key: ProjectMRCacheKey): Effect.Effect<
  { data: readonly MergeRequest[], timestamp: Date | null },
  MergeRequestsCacheError,
  MergeRequestStorage | EventStorage
> => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  const eventStorage = yield* EventStorage

  const cached = yield* storage.get(cacheKey);
  if (cached._tag === "Some") {
    yield* Console.log(`[Cache] Hit: ${cacheKey}`)
    return { data: cached.value.data, timestamp: cached.value.timestamp };
  }

  yield* Console.log(`[Cache] Miss: ${cacheKey}`)

  // Fetch and create event
  const event = yield* getGitlabMrsByProjectAsEvent(key.projectPath, key.state)

  // Append to event log (dual-write)
  yield* eventStorage.appendEvent(event)
  yield* Console.log(`[Event] Appended: ${event.type} for project ${event.forProjectPath}`)

  // Process event to get normalized MRs (same logic as getGitlabMrsByProject)
  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap((mr) => mr.jiraIssueKeys)))
  const tickets = yield* loadJiraTickets(jiraKeys)

  const fresh = gitlabMrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  yield* storage.set(cacheKey, fresh)
  return { data: fresh, timestamp: new Date() }
});

export const forceRefreshUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  const eventStorage = yield* EventStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)

  // Fetch and create event
  const event = yield* getGitlabMrsAsEvent(key.usernames as string[], key.state)

  // Append to event log (dual-write)
  yield* eventStorage.appendEvent(event)
  yield* Console.log(`[Event] Appended: ${event.type} for users ${event.forUsernames.join(', ')} (force refresh)`)

  // Process event to get normalized MRs
  const gitlabMrs = projectGitlabUserMrsFetchedEvent(event)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap((mr) => mr.jiraIssueKeys)))
  const tickets = yield* loadJiraTickets(jiraKeys)

  const fresh = gitlabMrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  yield* storage.set(cacheKey, fresh)

  return fresh
})






export const invalidateUserMRsCache = (key: MRCacheKey) => Effect.gen(function* () {
  const cacheKey = toCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  yield* Console.log(`[Cache] Invalidated: ${cacheKey}`)
})

export const invalidateProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  yield* storage.invalidate(cacheKey)
  yield* Console.log(`[Cache] Invalidated: ${cacheKey}`)
})



export const forceRefreshProjectMRsCache = (key: ProjectMRCacheKey) => Effect.gen(function* () {
  const cacheKey = toProjectCacheKeyString(key)
  const storage = yield* MergeRequestStorage
  const eventStorage = yield* EventStorage

  yield* Console.log(`[Cache] Force refresh: ${cacheKey}`)

  // Fetch and create event
  const event = yield* getGitlabMrsByProjectAsEvent(key.projectPath, key.state)

  // Append to event log (dual-write)
  yield* eventStorage.appendEvent(event)
  yield* Console.log(`[Event] Appended: ${event.type} for project ${event.forProjectPath} (force refresh)`)

  // Process event to get normalized MRs
  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap((mr) => mr.jiraIssueKeys)))
  const tickets = yield* loadJiraTickets(jiraKeys)

  const fresh = gitlabMrs
    .map((mr): MergeRequest => ({
      ...mr,
      jiraIssues: mr.jiraIssueKeys.flatMap((jiraKey) =>
        tickets.filter((t) => t.key === jiraKey)
      ),
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  yield* storage.set(cacheKey, fresh)

  return fresh
})