
import { Data } from "effect";
import { projectBitbucketMrsCompactedEvent, projectBitbucketPrsFetchedEvent } from "../bitbucket/bitbucket-projections";
import type { GitlabprojectMergeRequestsFetchedEvent } from "../events/gitlab-events";
import { projectGitlabUserMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabMrsCompactedEvent, projectGitlabMrsFetchedEvent } from "../gitlab/gitlab-projections";
import type { MrGid } from "../domain/identifiers";
import type { JiraIssue } from "../jira/jira-schema";
import { projectJiraIssuesFetchedEvent } from "../jira/jira-service";
import type { MergeRequest } from "./mergerequest-schema";
import type { CacheKey } from "./decide-fetch-mrs";
import { repositoryFullPath } from "../userselection/userSelection";
import { defineProjection, type ProjectionEventType } from "../utils/define-projection";

export class MrStateNotFetched extends Data.TaggedClass("NotFetched")<{}> {}

export class MrStateFetched extends Data.TaggedClass("Fetched")<{
  readonly data: readonly MergeRequest[]
  readonly timestamp: Date
}> {}

export type MrState = MrStateNotFetched | MrStateFetched

// Global MR state - all MRs indexed by IID
export class AllMrsState extends Data.TaggedClass("AllMrsState")<{
  readonly mrsByGid: ReadonlyMap<MrGid, MergeRequest>
  readonly jiraIssuesByKey: ReadonlyMap<string, JiraIssue>
  readonly timestamp: Date
}> {}

const initialAllMrsState = new AllMrsState({
  mrsByGid: new Map(),
  jiraIssuesByKey: new Map(),
  timestamp: new Date(0)
});

export const allMrsProjection = defineProjection({
  initialState: initialAllMrsState,
  handlers: {
    "gitlab-user-mrs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMrs = projectGitlabUserMrsFetchedEvent(event);
      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date()
      });
    },

    "gitlab-single-mr-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMr = projectGitlabSingleMrFetchedEvent(event);
      if (gitlabMr) {
        currentMap.set(gitlabMr.id, gitlabMr);
      }
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date()
      });
    },

    "gitlab-mrs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMrs = projectGitlabMrsFetchedEvent(event);

      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));

      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date()
      });
    },

    "gitlab-project-mrs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event);
      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date()
      });
    },

    "bitbucket-prs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const mrs = projectBitbucketPrsFetchedEvent(event, new Map());
      mrs.forEach(mr => currentMap.set(mr.id, mr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date()
      });
    },

    "jira-issues-fetched-event": (state, event) => {
      const currentJiraIssues = new Map(state.jiraIssuesByKey);
      const newJiraTickets = projectJiraIssuesFetchedEvent(event);
      newJiraTickets.forEach(ticket => currentJiraIssues.set(ticket.key, ticket));
      return new AllMrsState({
        mrsByGid: state.mrsByGid,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: state.timestamp
      });
    },

    "jira-sprint-issues-fetched-event": (state, event) => {
      const currentJiraIssues = new Map(state.jiraIssuesByKey);
      event.issues.forEach(ticket => currentJiraIssues.set(ticket.key, ticket));
      return new AllMrsState({
        mrsByGid: state.mrsByGid,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: state.timestamp
      });
    },

    "compacted-event": (state, event) => {
      const gitlabMrs = projectGitlabMrsCompactedEvent(event);
      const bitbucketMrs = projectBitbucketMrsCompactedEvent(event);
      const mrsByIid = new Map<MrGid, MergeRequest>(
        gitlabMrs.concat(bitbucketMrs).map(mr => [mr.id, mr])
      );
      const newJiraIssues = new Map<string, JiraIssue>();
      event.jiraIssues.forEach(issue => newJiraIssues.set(issue.key, issue));
      return new AllMrsState({
        mrsByGid: mrsByIid,
        jiraIssuesByKey: newJiraIssues,
        timestamp: new Date(),
      });
    },

  }
});

// Derived from the projection
export type MrRelevantEvent = ProjectionEventType<typeof allMrsProjection>;

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
    if (mrEvent.forState === key.state && mrEvent.forProjectPath === repositoryFullPath(key.repository)) {
      // Project GitLab MRs from the event
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(mrEvent)

      const enrichedMrs = gitlabMrs
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      return new MrStateFetched({ data: enrichedMrs, timestamp: new Date() })
    }
  }

  if (event.type === 'jira-issues-fetched-event' || event.type === 'jira-sprint-issues-fetched-event') {
    return state
  }

  // Event not relevant to this key, return state unchanged
  return state
}

