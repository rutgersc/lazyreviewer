import { HashMap, Option, Chunk } from "effect"
import type { LazyReviewerEvent } from "../../events/events"
import { defineProjection } from "../../utils/define-projection"

const MAX_EVENTS_PER_GROUP = 3

type EventsToDeleteState = {
  readonly eventIdsByGroup: HashMap.HashMap<string, Chunk.Chunk<string>>
  readonly eventIdsToDelete: Chunk.Chunk<string>
  readonly totalEventCount: number
}

const initialState: EventsToDeleteState = {
  eventIdsByGroup: HashMap.empty(),
  eventIdsToDelete: Chunk.empty(),
  totalEventCount: 0,
}

const eventGroupKey = (event: LazyReviewerEvent): string => {
  switch (event.type) {
    case "gitlab-user-mrs-fetched-event":
      return `${event.type}|${[...event.forUsernames].sort().join(",")}|${event.forState}`
    case "gitlab-project-mrs-fetched-event":
      return `${event.type}|${event.forProjectPath}|${event.forState}`
    case "gitlab-single-mr-fetched-event":
      return `${event.type}|${event.forProjectPath}|${event.forIid}`
    case "gitlab-mrs-fetched-event":
      return `${event.type}|${event.forProjectPath}|${[...event.forIids].sort().join(",")}`
    case "gitlab-jobtrace-fetched-event":
      return `${event.type}|${event.forProjectId}|${event.forJobId}`
    case "gitlab-pipeline-fetched-event":
      return `${event.type}|${event.forProjectPath}|${event.forIid}`
    case "gitlab-jobhistory-fetched-event":
      return `${event.type}|${event.forProjectPath}|${event.forJobName}`
    case "jira-issues-fetched-event":
      return `${event.type}|${[...event.forTicketKeys].sort().join(",")}`
    case "jira-sprint-issues-fetched-event":
      return `${event.type}|${event.boardId}|${event.sprintId}`
    case "jira-sprints-loaded-event":
      return `${event.type}|${event.boardId}`
    case "bitbucket-prs-fetched-event":
      return `${event.type}|${event.forWorkspace}|${event.forRepoSlug}|${event.forState}`
    case "bitbucket-single-pr-fetched-event":
      return `${event.type}|${event.forWorkspace}|${event.forRepoSlug}|${event.forPrId}`
    case "bitbucket-pr-comments-fetched-event":
      return `${event.type}|${event.forWorkspace}|${event.forRepoSlug}|${event.forPrId}`
  }
}

const trackEvent = (state: EventsToDeleteState, key: string, eventId: string): EventsToDeleteState => {
  const existing = Option.getOrElse(HashMap.get(state.eventIdsByGroup, key), () => Chunk.empty<string>())
  const nextTotal = state.totalEventCount + 1

  // Group is not yet full — just append
  if (Chunk.size(existing) < MAX_EVENTS_PER_GROUP) {
    return {
      eventIdsByGroup: HashMap.set(state.eventIdsByGroup, key, Chunk.append(existing, eventId)),
      eventIdsToDelete: state.eventIdsToDelete,
      totalEventCount: nextTotal,
    }
  }

  // Group is full — evict the oldest, replace with new
  const evicted = Chunk.headUnsafe(existing)
  const kept = Chunk.append(Chunk.drop(existing, 1), eventId)
  return {
    eventIdsByGroup: HashMap.set(state.eventIdsByGroup, key, kept),
    eventIdsToDelete: Chunk.append(state.eventIdsToDelete, evicted),
    totalEventCount: nextTotal,
  }
}

const handler = <E extends LazyReviewerEvent>(state: EventsToDeleteState, event: E): EventsToDeleteState =>
  trackEvent(state, eventGroupKey(event), event.eventId)

export const eventsToDeleteTodoList = defineProjection({
  initialState,
  handlers: {
    "gitlab-user-mrs-fetched-event": handler,
    "gitlab-project-mrs-fetched-event": handler,
    "gitlab-single-mr-fetched-event": handler,
    "gitlab-mrs-fetched-event": handler,
    "gitlab-jobtrace-fetched-event": handler,
    "gitlab-pipeline-fetched-event": handler,
    "gitlab-jobhistory-fetched-event": handler,
    "jira-issues-fetched-event": handler,
    "jira-sprint-issues-fetched-event": handler,
    "jira-sprints-loaded-event": handler,
    "bitbucket-prs-fetched-event": handler,
    "bitbucket-single-pr-fetched-event": handler,
    "bitbucket-pr-comments-fetched-event": handler,
  },
})
