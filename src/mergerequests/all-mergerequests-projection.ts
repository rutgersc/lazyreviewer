import { Data } from "effect";
import { projectBitbucketPrsFetchedEvent } from "../bitbucket/bitbucket-projections";
import { projectGitlabUserMrsFetchedEvent, projectGitlabSingleMrFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabMrsFetchedEvent } from "../gitlab/gitlab-projections";
import type { MrGid } from "../domain/identifiers";
import type { JiraIssue } from "../jira/jira-schema";
import { projectJiraIssuesFetchedEvent } from "../jira/jira-service";
import type { MergeRequest } from "./mergerequest-schema";
import { defineProjection, type ProjectionEventType } from "../utils/define-projection";

export class AllMrsState extends Data.TaggedClass("AllMrsState")<{
  readonly mrsByGid: ReadonlyMap<MrGid, MergeRequest>
  readonly jiraIssuesByKey: ReadonlyMap<string, JiraIssue>
  readonly timestamp: Date
}> {}

const initialAllMrsState = new AllMrsState({
  mrsByGid: new Map(),
  jiraIssuesByKey: new Map(),
  timestamp: new Date(0),
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
        timestamp: new Date(),
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
        timestamp: new Date(),
      });
    },

    "gitlab-mrs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMrs = projectGitlabMrsFetchedEvent(event);
      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date(),
      });
    },

    "gitlab-project-mrs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const gitlabMrs = projectGitlabProjectMrsFetchedEvent(event);
      gitlabMrs.forEach(gitlabMr => currentMap.set(gitlabMr.id, gitlabMr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date(),
      });
    },

    "bitbucket-prs-fetched-event": (state, event) => {
      const currentMap = new Map(state.mrsByGid);
      const mrs = projectBitbucketPrsFetchedEvent(event, new Map());
      mrs.forEach(mr => currentMap.set(mr.id, mr));
      return new AllMrsState({
        mrsByGid: currentMap,
        jiraIssuesByKey: state.jiraIssuesByKey,
        timestamp: new Date(),
      });
    },

    "jira-issues-fetched-event": (state, event) => {
      const currentJiraIssues = new Map(state.jiraIssuesByKey);
      const newJiraTickets = projectJiraIssuesFetchedEvent(event);
      newJiraTickets.forEach(ticket => currentJiraIssues.set(ticket.key, ticket));
      return new AllMrsState({
        mrsByGid: state.mrsByGid,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: state.timestamp,
      });
    },

    "jira-sprint-issues-fetched-event": (state, event) => {
      const currentJiraIssues = new Map(state.jiraIssuesByKey);
      event.issues.forEach(ticket => currentJiraIssues.set(ticket.key, ticket));
      return new AllMrsState({
        mrsByGid: state.mrsByGid,
        jiraIssuesByKey: currentJiraIssues,
        timestamp: state.timestamp,
      });
    },
  }
});

export type MrRelevantEvent = ProjectionEventType<typeof allMrsProjection>;
