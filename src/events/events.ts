import { GitlabEventSchema, type GitlabEvent } from "./gitlab-events";
import { JiraEventSchema, type JiraEvent } from "./jira-events";
import { BitbucketEventSchema, type BitbucketEvent } from "./bitbucket-events";
import { CompactionEventSchemaUnion, type CompactedEvent } from "./event-compaction-events";
import { Schema } from "effect";

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

export { EventStorage } from "../eventstore/eventStorage"
