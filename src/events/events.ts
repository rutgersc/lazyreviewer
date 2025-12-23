import { GitlabEventSchema, type GitlabEvent } from "./gitlab-events";
import { JiraEventSchema, type JiraEvent } from "./jira-events";
import { BitbucketEventSchema, type BitbucketEvent } from "./bitbucket-events";
import { CompactionEventSchemaUnion, type CompactedEvent } from "./event-compaction-events";
import { Schema } from "effect";
import type { JiraSprint } from "../jira/jira-sprint-schema";

// Persisted events - stored to disk
export type LazyReviewerEvent =
    | GitlabEvent
    | JiraEvent
    | BitbucketEvent
    | CompactedEvent

export const EventSchema = Schema.Union(
  GitlabEventSchema,
  BitbucketEventSchema,
  JiraEventSchema,
  CompactionEventSchemaUnion
)

// In-memory events - not persisted, transient state
export type JiraSprintsLoadedEvent = {
  type: "jira-sprints-loaded-event";
  boardId: number;
  sprints: JiraSprint[];
  timestamp: string;
};

export type JiraSprintSelectedEvent = {
  type: "jira-sprint-selected-event";
  sprintId: number;
  boardId: number;
  timestamp: string;
};

export type InMemoryLazyReviewerEvent =
  | JiraSprintsLoadedEvent
  | JiraSprintSelectedEvent;

// Combined type for streams that include both
export type AnyLazyReviewerEvent =
  | LazyReviewerEvent
  | InMemoryLazyReviewerEvent;

export { EventStorage } from "../eventstore/eventStorage"
