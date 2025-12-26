import { GitlabEventSchema, type GitlabEvent } from "./gitlab-events";
import { JiraEventSchema, type JiraEvent } from "./jira-events";
import { BitbucketEventSchema, type BitbucketEvent } from "./bitbucket-events";
import { CompactionEventSchemaUnion, type CompactedEvent } from "./event-compaction-events";
import { Schema } from "effect";

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
// Currently unused but kept for future transient UI state
export type InMemoryLazyReviewerEvent = never;

// Combined type for streams that include both
export type AnyLazyReviewerEvent =
  | LazyReviewerEvent
  | InMemoryLazyReviewerEvent;

export { EventStorage } from "../eventstore/eventStorage"
