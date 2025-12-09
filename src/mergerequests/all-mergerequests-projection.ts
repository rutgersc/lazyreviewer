
import { Data } from "effect";
import { projectBitbucketMrsCompactedEvent } from "../bitbucket/bitbucket-projections";
import type { CompactedEvent } from "../events/event-compaction-events";
import type { LazyReviewerEvent } from "../events/events";
import type { GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabUserMergeRequestsFetchedEvent } from "../events/gitlab-events";
import type { JiraIssuesFetchedEvent } from "../events/jira-events";
import { projectGitlabUserMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabMrsCompactedEvent } from "../gitlab/gitlab-projections";
import type { JiraIssue } from "../jira/jira-schema";
import { projectJiraIssuesFetchedEvent } from "../jira/jira-service";
import type { MergeRequest } from "./mergerequest-schema";
import type { CacheKey } from "./decide-fetch-mrs";

export type MrRelevantEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | JiraIssuesFetchedEvent
  | GitlabSingleMrFetchedEvent
  | CompactedEvent

export const isMrRelevantEvent = (event: LazyReviewerEvent): event is MrRelevantEvent => {
  return event.type === 'gitlab-user-mrs-fetched-event' ||
    event.type === 'gitlab-project-mrs-fetched-event' ||
    event.type === 'gitlab-single-mr-fetched-event' ||
    event.type === 'jira-issues-fetched-event' ||
    event.type === 'compacted-event'
}

export class MrStateNotFetched extends Data.TaggedClass("NotFetched")<{}> {}

export class MrStateFetched extends Data.TaggedClass("Fetched")<{
  readonly data: readonly MergeRequest[]
  readonly timestamp: Date
}> {}

export type MrState = MrStateNotFetched | MrStateFetched

// Global MR state - all MRs indexed by ID
export class AllMrsState extends Data.TaggedClass("AllMrsState")<{
  readonly mrsByGid: ReadonlyMap<string, MergeRequest>
  readonly jiraIssuesByKey: ReadonlyMap<string, JiraIssue>
  readonly timestamp: Date
}> {}

// Project all MRs into a single indexed map
export const projectAllMrs = (state: AllMrsState, event: MrRelevantEvent): AllMrsState => {
  const currentMap = new Map(state.mrsByGid);
  const currentJiraIssues = new Map(state.jiraIssuesByKey);

  switch (event.type)
  {
    case 'gitlab-user-mrs-fetched-event': {
      const gitlabMrs = projectGitlabUserMrsFetchedEvent(event);

      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));

      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: new Date()
      });
    }

    case 'gitlab-single-mr-fetched-event': {
      const gitlabMr = projectGitlabSingleMrFetchedEvent(event);
      if (gitlabMr) {
        currentMap.set(gitlabMr.id, gitlabMr);
      }
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: new Date()
      });
    }

    case 'gitlab-project-mrs-fetched-event': {
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event);

      gitlabMrs.forEach(gitlabMr => {
        // No longer enriching with Jira issues directly
        currentMap.set(gitlabMr.id, gitlabMr);
      });

      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: new Date()
      });
    }

    case 'jira-issues-fetched-event': {
      const newJiraTickets = projectJiraIssuesFetchedEvent(event);

      newJiraTickets.forEach(ticket => {
        currentJiraIssues.set(ticket.key, ticket);
      });

      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: state.timestamp // Keep original timestamp
      });
    }

    case "compacted-event": {
      const gitlabMrs = projectGitlabMrsCompactedEvent(event);
      const bitbucketMrs = projectBitbucketMrsCompactedEvent(event);

      var mrsByGid = new Map<string, MergeRequest>(
        gitlabMrs.concat(bitbucketMrs).map(mr => [mr.id, mr])
      );

      // Also project Jira issues from the compacted event
      const newJiraIssues = new Map<string, JiraIssue>();
      event.jiraIssues.forEach(issue => {
        newJiraIssues.set(issue.key, issue);
      });

      return new AllMrsState({
        mrsByGid: mrsByGid,
        jiraIssuesByKey: newJiraIssues,
        timestamp: new Date(),
      });
    }

    default:
      const _: never = event;
      throw new Error("Unreachable")
  }
};

// Pure projection function for folding events into MR state
// Returns a projection function specialized for a specific cache key
export const projectMrState = (key: CacheKey) => (state: MrState, event: MrRelevantEvent): MrState => {
  // console.log("Projecting", { key:key._tag, eventtype: event.type })

  if (key._tag === "UserMRs" && event.type === 'gitlab-user-mrs-fetched-event') {
    if (
      event.forState === key.state &&
      event.forUsernames.length === key.usernames.length &&
      event.forUsernames.every((u: string) => key.usernames.includes(u))
    ) {
      // Project GitLab MRs from the event
      const gitlabMrs = projectGitlabUserMrsFetchedEvent(event)

      const enrichedMrs = gitlabMrs
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

      const enrichedMrs = gitlabMrs
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      return new MrStateFetched({ data: enrichedMrs, timestamp: new Date() })
    }
  }

  if (event.type === 'jira-issues-fetched-event') {
    return state
  }

  // Event not relevant to this key, return state unchanged
  return state
}

