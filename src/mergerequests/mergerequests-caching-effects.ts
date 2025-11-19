import { Effect, Data, Console, Context, Option, Chunk } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { ParseError } from "effect/ParseResult"
import { type MergeRequest } from "./mergerequest-schema"
import { fetchMergeRequestsByProject, fetchMergeRequests } from "./mergerequests-effects"
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types"
import { EventStorage, type Event } from "../events/events"
import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent } from "../events/gitlab-events"
import type { JiraIssuesFetchedEvent } from "../events/jira-events"
import type { FetchGitlabMrsError, FetchGitlabProjectMrsError } from "../gitlab/gitlab-graphql"
import type { SearchJiraIssuesError, JiraIssue } from "../jira/jira-service"
import type { BitbucketCredentialsNotConfiguredError, FetchBitbucketPrsError, BitbucketPrsJsonParseError } from "../bitbucket/bitbucketapi"
import { getGitlabMrsAsEvent, getGitlabMrsByProjectAsEvent } from "../gitlab/gitlab-graphql"
import { loadJiraTicketsAsEvent, projectJiraIssuesFetchedEvent } from "../jira/jira-service"
import type { GitlabMergeRequest } from "../gitlab/gitlab-schema"
import { projectGitlabProjectMrsFetchedEvent, projectGitlabUserMrsFetchedEvent } from "../gitlab/gitlab-projections"

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

// Helper functions for event projection

const findLatestUserMrsEvent = (
  events: readonly Event[],
  usernames: readonly string[],
  state: MergeRequestState
): Option.Option<GitlabUserMergeRequestsFetchedEvent> => {
  const relevantEvents = events.filter(
    (event): event is GitlabUserMergeRequestsFetchedEvent =>
      event.type === 'gitlab-user-mrs-fetched-event' &&
      event.forState === state &&
      event.forUsernames.length === usernames.length &&
      event.forUsernames.every(u => usernames.includes(u))
  )

  if (relevantEvents.length === 0) {
    return Option.none()
  }

  // Events are already sorted by event number (filename), so last one is most recent
  const lastEvent = relevantEvents[relevantEvents.length - 1]
  return lastEvent ? Option.some(lastEvent) : Option.none()
}

const findLatestProjectMrsEvent = (
  events: readonly Event[],
  projectPath: string,
  state: MergeRequestState
): Option.Option<GitlabprojectMergeRequestsFetchedEvent> => {
  const relevantEvents = events.filter(
    (event): event is GitlabprojectMergeRequestsFetchedEvent =>
      event.type === 'gitlab-project-mrs-fetched-event' &&
      event.forState === state &&
      event.forProjectPath === projectPath
  )

  if (relevantEvents.length === 0) {
    return Option.none()
  }

  // Events are already sorted by event number, so last one is most recent
  const lastEvent = relevantEvents[relevantEvents.length - 1]
  return lastEvent ? Option.some(lastEvent) : Option.none()
}

const loadJiraTicketsFromEvents = (
  events: readonly Event[],
  ticketKeys: readonly string[]
): JiraIssue[] => {
  const relevantEvents = events.filter(
    (event): event is JiraIssuesFetchedEvent =>
      event.type === 'jira-issues-fetched-event' &&
      event.forTicketKeys.some(key => ticketKeys.includes(key))
  )

  return relevantEvents.flatMap(event => projectJiraIssuesFetchedEvent(event))
}

const enrichMrWithJiraIssues = (mr: GitlabMergeRequest, jiraTickets: readonly JiraIssue[]): MergeRequest => ({
  ...mr,
  jiraIssues: mr.jiraIssueKeys.flatMap(jiraKey =>
    jiraTickets.filter(t => t.key === jiraKey)
  )
})

// CQRS: Command side - ensures events exist
export const decideFetchUserMrs = (usernames: string[], state: MergeRequestState): Effect.Effect<
  void,
  MergeRequestsCacheError,
  EventStorage
> => Effect.gen(function* () {
  // Fetch new MR event
  const mrEvent = yield* getGitlabMrsAsEvent(usernames, state)
  yield* EventStorage.appendEvent(mrEvent)

  // Fetch Jira events
  const gitlabMrs = projectGitlabUserMrsFetchedEvent(mrEvent)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys)
  yield* EventStorage.appendEvent(jiraEvent)
})

// CQRS: Command side - ensures events exist
export const decideFetchProjectMrs = (projectPath: string, state: MergeRequestState): Effect.Effect<
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

// CQRS: Query side - projects data from events
export const queryProjectMRsFromEvents = (
  allEvents: readonly Event[],
  key: ProjectMRCacheKey
): MrState => {
  const cachedMrEvent = findLatestProjectMrsEvent(allEvents, key.projectPath, key.state)

  if (Option.isNone(cachedMrEvent)) {
    return new MrStateNotFetched()
  }

  const gitlabMrs = projectGitlabProjectMrsFetchedEvent(cachedMrEvent.value)
  const jiraKeys = Array.from(new Set(gitlabMrs.flatMap(mr => mr.jiraIssueKeys)))
  const jiraTickets = loadJiraTicketsFromEvents(allEvents, jiraKeys)

  const data = gitlabMrs
    .map(mr => enrichMrWithJiraIssues(mr, jiraTickets))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  return new MrStateFetched({ data, timestamp: new Date() })
}

export class MrStateNotFetched extends Data.TaggedClass("NotFetched")<{}> {}

export class MrStateFetched extends Data.TaggedClass("Fetched")<{
  readonly data: readonly MergeRequest[]
  readonly timestamp: Date
}> {}

export type MrState = MrStateNotFetched | MrStateFetched

// Events that are relevant for MR state projection
export type MrRelevantEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | JiraIssuesFetchedEvent

// Global MR state - all MRs indexed by ID
export class AllMrsState extends Data.TaggedClass("AllMrsState")<{
  readonly mrsByGid: ReadonlyMap<string, MergeRequest>
  readonly timestamp: Date
}> {}

// Project all MRs into a single indexed map
export const projectAllMrs = (state: AllMrsState, event: MrRelevantEvent): AllMrsState => {
  const currentMap = new Map(state.mrsByGid);

  // Handle GitLab user MRs
  if (event.type === 'gitlab-user-mrs-fetched-event') {
    const gitlabMrs = projectGitlabUserMrsFetchedEvent(event);

    // Update/add each MR to the map
    gitlabMrs.forEach(gitlabMr => {
      const existing = currentMap.get(gitlabMr.id);
      const jiraIssues = existing?.jiraIssues || [];
      const enriched = enrichMrWithJiraIssues(gitlabMr, jiraIssues);
      currentMap.set(gitlabMr.id, enriched);
    });

    return new AllMrsState({
      mrsByGid: currentMap,
      timestamp: new Date()
    });
  }

  // Handle GitLab project MRs
  if (event.type === 'gitlab-project-mrs-fetched-event') {
    const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event);

    gitlabMrs.forEach(gitlabMr => {
      const existing = currentMap.get(gitlabMr.id);
      const jiraIssues = existing?.jiraIssues || [];
      const enriched = enrichMrWithJiraIssues(gitlabMr, jiraIssues);
      currentMap.set(gitlabMr.id, enriched);
    });

    return new AllMrsState({
      mrsByGid: currentMap,
      timestamp: new Date()
    });
  }

  // Handle Jira issues - enrich all MRs that reference these issues
  if (event.type === 'jira-issues-fetched-event') {
    const newJiraTickets = projectJiraIssuesFetchedEvent(event);

    // Re-enrich all MRs that have jira issue keys matching the new tickets
    currentMap.forEach((mr, gid) => {
      if (mr.jiraIssueKeys.some(key => newJiraTickets.some(ticket => ticket.key === key))) {
        const { jiraIssues, ...gitlabMr } = mr;
        const allJiraTickets = [...jiraIssues, ...newJiraTickets];
        const enriched = enrichMrWithJiraIssues(gitlabMr as GitlabMergeRequest, allJiraTickets);
        currentMap.set(gid, enriched);
      }
    });

    return new AllMrsState({
      mrsByGid: currentMap,
      timestamp: state.timestamp // Keep original timestamp for Jira enrichment
    });
  }

  return state;
};

// Pure projection function for folding events into MR state
// Returns a projection function specialized for a specific cache key
export const projectMrState = (key: CacheKey) => (state: MrState, event: MrRelevantEvent): MrState => {
  // console.log("Projecting", { key:key._tag, eventtype: event.type })

  if (key._tag === "UserMRs" && event.type === 'gitlab-user-mrs-fetched-event') {
    if (
      event.forState === key.state &&
      event.forUsernames.length === key.usernames.length &&
      event.forUsernames.every(u => key.usernames.includes(u))
    ) {
      // Project GitLab MRs from the event
      const gitlabMrs = projectGitlabUserMrsFetchedEvent(event)

      // Enrich with existing Jira data from state
      const jiraTickets = state._tag === "Fetched"
        ? state.data.flatMap(mr => mr.jiraIssues)
        : []
      const enrichedMrs = gitlabMrs
        .map(mr => enrichMrWithJiraIssues(mr, jiraTickets))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      return new MrStateFetched({ data: enrichedMrs, timestamp: new Date() })
    }
  }

  // Handle GitlabprojectMergeRequestsFetchedEvent
  if (key._tag === "ProjectMRs" && event.type === 'gitlab-project-mrs-fetched-event') {
    const mrEvent = event as GitlabprojectMergeRequestsFetchedEvent

    // Check if this event matches our key
    if (mrEvent.forState === key.state && mrEvent.forProjectPath === key.projectPath) {
      // Project GitLab MRs from the event
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)

      // Enrich with existing Jira data from state
      const jiraTickets = state._tag === "Fetched"
        ? state.data.flatMap(mr => mr.jiraIssues)
        : []
      const enrichedMrs = gitlabMrs
        .map(mr => enrichMrWithJiraIssues(mr, jiraTickets))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      return new MrStateFetched({ data: enrichedMrs, timestamp: new Date() })
    }
  }

  // Handle JiraIssuesFetchedEvent - enrich existing MRs
  if (event.type === 'jira-issues-fetched-event') {
    // Only enrich if we have fetched MRs
    if (state._tag === "NotFetched") {
      return state
    }

    const newJiraTickets = projectJiraIssuesFetchedEvent(event)

    // Get all Jira tickets (existing + new)
    const existingJiraTickets = state.data.flatMap(mr => mr.jiraIssues)
    const allJiraTickets = [...existingJiraTickets, ...newJiraTickets]

    // Re-enrich all MRs with updated Jira data
    const enrichedMrs = state.data.map(mr => {
      // Get raw GitLab MR data (without jiraIssues)
      const { jiraIssues, ...gitlabMr } = mr
      return enrichMrWithJiraIssues(gitlabMr as GitlabMergeRequest, allJiraTickets)
    })

    return new MrStateFetched({ data: enrichedMrs, timestamp: state.timestamp })
  }

  // Event not relevant to this key, return state unchanged
  return state
}







