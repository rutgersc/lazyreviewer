import { GitlabEventSchema, type GitlabEvent } from "./gitlab-events";
import { JiraEventSchema, type JiraEvent } from "./jira-events";
import { BitbucketEventSchema, type BitbucketEvent } from "./bitbucket-events";
import { CompactionEventSchema, type MergeRequestsCompactedEvent } from "./event-compaction-events";
import { Schema } from "effect";

export type Event =
    | GitlabEvent
    | JiraEvent
    | BitbucketEvent
    | MergeRequestsCompactedEvent

export const EventSchema = Schema.Union(
  GitlabEventSchema,
  BitbucketEventSchema,
  JiraEventSchema,
  CompactionEventSchema
)

export { EventStorage } from "../eventstore/eventStorage"
