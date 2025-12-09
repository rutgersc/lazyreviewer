import { Stream, Effect, Chunk } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";
import { projectEventsToCompactedState, compactedStateToEvent, type CompactedState } from "./project-to-compacted-state";

export const allEventsIncludingCompactedAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.allEventsStream).pipe(
    Stream.groupedWithin(100, "0.15 seconds"),
    Stream.scan([] as LazyReviewerEvent[], (acc, events) =>
      Chunk.reduce(events, acc, (currentAcc, event) => [...currentAcc, event])
    )
  ),
  { initialValue: [] }
)

export const compactAllEventsAtom = appAtomRuntime.fn(() =>
  Effect.gen(function* () {
    const allEvents = yield* EventStorage.loadEvents

    const compactedState = projectEventsToCompactedState(allEvents);

    if (compactedState.mergeRequests.size === 0 && compactedState.jiraIssues.size === 0) {
      return { success: false, message: "No events to compact" };
    }

    const compactedEvent = compactedStateToEvent(compactedState);
    yield* EventStorage.appendEvent(compactedEvent);

    const parts: string[] = [];
    parts.push(`${compactedState.mergeRequests.size} MRs`);
    parts.push(`${compactedState.jiraIssues.size} Jira issues`);

    return { success: true, message: `Compacted all events into ${parts.join(' and ')}` };
  })
);