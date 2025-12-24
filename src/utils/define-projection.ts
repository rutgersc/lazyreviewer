import type { AnyLazyReviewerEvent } from "../events/events";

// =============================================================================
// Event Registry - automatically maps event type strings to their interfaces
// =============================================================================

// Creates a registry from a union: { "event-type-a": EventA, "event-type-b": EventB, ... }
type EventRegistry<E extends { type: string }> = {
  [Event in E as Event["type"]]: Event;
};

// Registry for all events
type AllEventRegistry = EventRegistry<AnyLazyReviewerEvent>;

// =============================================================================
// Projection Definition Types
// =============================================================================

// Handler for a specific event
type Handler<S, E> = (state: S, event: E) => S;

// Handlers object: keys are event type strings, values are handlers
type HandlersConfig<S, EventTypes extends keyof AllEventRegistry> = {
  [K in EventTypes]: Handler<S, AllEventRegistry[K]>;
};

// Extract the event union from handler keys
type EventUnionFromHandlers<EventTypes extends keyof AllEventRegistry> =
  AllEventRegistry[EventTypes];

// =============================================================================
// Projection Result Type
// =============================================================================

export interface Projection<S, E extends AnyLazyReviewerEvent> {
  initialState: S;
  isRelevantEvent: (event: AnyLazyReviewerEvent) => event is E;
  project: (state: S, event: E) => S;
  // Expose the event type for external use (e.g., in stream filtering)
  _eventType: E;
}

// =============================================================================
// defineProjection - Single source of truth for projections
// =============================================================================

export function defineProjection<
  S,
  const EventTypes extends keyof AllEventRegistry,
>(config: {
  initialState: S;
  handlers: HandlersConfig<S, EventTypes>;
}): Projection<S, EventUnionFromHandlers<EventTypes>> {

  type RelevantEvent = EventUnionFromHandlers<EventTypes>;

  const eventTypes = new Set(Object.keys(config.handlers));

  const isRelevantEvent = (event: AnyLazyReviewerEvent): event is RelevantEvent => {
    return eventTypes.has(event.type);
  };

  const project = (state: S, event: RelevantEvent): S => {
    const handler = config.handlers[event.type as EventTypes];
    if (handler) {
      return handler(state, event as AllEventRegistry[EventTypes]);
    }
    return state;
  };

  return {
    initialState: config.initialState,
    isRelevantEvent,
    project,
    _eventType: null as unknown as RelevantEvent,
  };
}

// =============================================================================
// Helper type to extract event type from a projection
// =============================================================================

export type ProjectionEventType<P> = P extends Projection<any, infer E> ? E : never;
export type ProjectionStateType<P> = P extends Projection<infer S, any> ? S : never;

// =============================================================================
// Stream combinator - filter + scan in one step
// =============================================================================

import { Stream } from "effect";

/**
 * Applies a projection to a stream: filters relevant events and scans to produce state.
 *
 * @example
 * ```ts
 * Stream.unwrap(EventStorage.combinedEventsStream).pipe(
 *   project(sprintIssuesProjection)
 * )
 * ```
 */
export const project = <S, E extends AnyLazyReviewerEvent>(
  projection: Projection<S, E>
) => <R, Err>(
  stream: Stream.Stream<AnyLazyReviewerEvent, Err, R>
): Stream.Stream<S, Err, R> =>
  stream.pipe(
    Stream.filter(projection.isRelevantEvent),
    Stream.scan(projection.initialState, projection.project)
  );