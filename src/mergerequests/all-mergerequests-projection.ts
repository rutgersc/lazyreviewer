
import { Data } from "effect";
import { mapBitbucketToGitlabMergeRequest } from "../bitbucket/bitbucket-projections";
import type { MergeRequestsCompactedEvent } from "../events/event-compaction-events";
import type { GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabUserMergeRequestsFetchedEvent } from "../events/gitlab-events";
import type { JiraIssuesFetchedEvent } from "../events/jira-events";
import { projectGitlabUserMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabProjectMrsFetchedEvent, mapMrFragment } from "../gitlab/gitlab-projections";
import type { JiraIssue } from "../jira/jira-schema";
import { projectJiraIssuesFetchedEvent } from "../jira/jira-service";
import type { MergeRequest } from "./mergerequest-schema";
import type { CacheKey } from "./decide-fetch-mrs";

export type MrRelevantEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | JiraIssuesFetchedEvent
  | GitlabSingleMrFetchedEvent
  | MergeRequestsCompactedEvent

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

  if (event.type === 'gitlab-user-mrs-fetched-event') {
    const gitlabMrs = projectGitlabUserMrsFetchedEvent(event);

    // Update/add each MR to the map
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

  if (event.type === 'gitlab-single-mr-fetched-event') {
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

  // Handle GitLab project MRs
  if (event.type === 'gitlab-project-mrs-fetched-event') {
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
  else if (event.type === 'jira-issues-fetched-event') {
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
  else if (event.type === "mergerequests-compacted-event") {
    const newMap = new Map<string, MergeRequest>();

    event.mrs.forEach((rawMr, index) => {
      // Discriminate by checking for Bitbucket-specific fields (source/destination)
      if ("source" in rawMr && "destination" in rawMr) {
        // Bitbucket PR
        const fullPath = rawMr.destination.repository.full_name;
        const [workspace = "", repoSlug = ""] = fullPath.split("/");
        const mr = mapBitbucketToGitlabMergeRequest(rawMr, workspace, repoSlug);
        newMap.set(mr.id, mr);
      } else if ("iid" in rawMr && "project" in rawMr) {
        // GitLab MR (MergeRequestFieldsFragment)
        const mr = mapMrFragment(rawMr);
        newMap.set(mr.id, mr);
      }
    });

    return new AllMrsState({
      mrsByGid: newMap,
      jiraIssuesByKey: currentJiraIssues,
      timestamp: new Date(),
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

  // Handle JiraIssuesFetchedEvent - enrich existing MRs
  if (event.type === 'jira-issues-fetched-event') {
    // Since we don't enrich anymore, we just return the state as is,
    // but we might want to update the timestamp if that's important.
    // However, the state.data only contains MRs without jiraIssues now.
    return state
  }

  // Event not relevant to this key, return state unchanged
  return state
}

