# Phase 1: Event Stream Storage Foundation

## Goal
Create an append-only event log with auto-incrementing IDs to store all fetch operations.

## Dependencies
None - foundational phase

## Tasks

### Task 1.1: Event Schema Definition

**Define core event types:**

```typescript
// src/events/eventTypes.ts

type FetchEvent = {
  eventId: number              // Auto-increment: 1, 2, 3, ...
  timestamp: Date              // When fetch occurred
  fetchType: FetchType
  scope: FetchScope
  rawResponse: unknown         // Exact API response (JSON)
}

type FetchType =
  | 'repo'        // Fetched all MRs in repository
  | 'user'        // Fetched all MRs by author
  | 'single-mr'   // Refreshed single MR

type FetchScope =
  | { type: 'repo', repoId: string }
  | { type: 'user', username: string }
  | { type: 'single-mr', mrId: string }

// Event metadata for querying
type EventMetadata = Omit<FetchEvent, 'rawResponse'>
```

**Key Design Decisions:**
- Store raw API response as `unknown` (exact JSON from GraphQL/REST)
- eventId is simple counter (1, 2, 3, ...) - no UUIDs needed
- timestamp for ordering and last-write-wins logic
- scope allows filtering events by what was fetched

### Task 1.2: Event Storage Service

**Extend existing storage or create new service:**

```typescript
// src/services/eventStorage.ts

interface EventStorage {
  // Append new event (returns assigned eventId)
  appendEvent(event: Omit<FetchEvent, 'eventId'>): Effect<number>

  // Get next eventId (for incrementing)
  getNextEventId(): Effect<number>

  // Read single event
  getEvent(eventId: number): Effect<FetchEvent | null>

  // Read event range (for projection)
  getEvents(fromId: number, toId?: number): Effect<FetchEvent[]>

  // Get all events (for full projection)
  getAllEvents(): Effect<FetchEvent[]>

  // Get event metadata (without rawResponse, for UI)
  getEventMetadata(fromId: number, toId?: number): Effect<EventMetadata[]>

  // Get latest eventId (current head of log)
  getLatestEventId(): Effect<number>
}
```

**Implementation Approach:**
1. Use existing `MergeRequestStorage` pattern (Effect KeyValueStore)
2. Storage keys:
   - `event_{eventId}` → FetchEvent (full event with raw response)
   - `event_counter` → number (current max eventId)
   - `event_index` → number[] (list of all eventIds for fast enumeration)

3. Append operation:
   ```typescript
   appendEvent(event):
     1. Increment counter atomically
     2. Store event with new ID
     3. Update index
     4. Return eventId
   ```

**Storage Schema:**
```typescript
// KeyValueStore entries
{
  "event_1": { eventId: 1, timestamp: "...", fetchType: "repo", ... },
  "event_2": { eventId: 2, timestamp: "...", fetchType: "user", ... },
  // ...
  "event_counter": 42,                    // Latest eventId
  "event_index": [1, 2, 3, ..., 42]      // All eventIds
}
```

**Error Handling:**
- Failed appends don't increment counter (atomic)
- Validation: eventId must be sequential
- Malformed events logged but don't block future appends

### Task 1.3: Event Append Functions

**Create convenience functions for each fetch type:**

```typescript
// src/events/eventAppenders.ts

export const appendRepoFetchEvent = (
  repoId: string,
  rawResponse: unknown
): Effect<number> => {
  return appendEvent({
    timestamp: new Date(),
    fetchType: 'repo',
    scope: { type: 'repo', repoId },
    rawResponse
  });
};

export const appendUserFetchEvent = (
  username: string,
  rawResponse: unknown
): Effect<number> => {
  return appendEvent({
    timestamp: new Date(),
    fetchType: 'user',
    scope: { type: 'user', username },
    rawResponse
  });
};

export const appendSingleMRFetchEvent = (
  mrId: string,
  rawResponse: unknown
): Effect<number> => {
  return appendEvent({
    timestamp: new Date(),
    fetchType: 'single-mr',
    scope: { type: 'single-mr', mrId },
    rawResponse
  });
};
```

**Usage Pattern:**
```typescript
// In fetch functions
const rawResponse = await fetchFromGitLabAPI(...);
yield* appendRepoFetchEvent('elab/elab', rawResponse);
// Projection will be triggered automatically
```

## Files to Create/Modify

### New Files
- `src/events/eventTypes.ts` - Event schema types
- `src/events/eventStorage.ts` - Event storage service (Effect-based)
- `src/events/eventAppenders.ts` - Convenience append functions

### Files to Reference
- `src/services/mergeRequestStorage.ts` - Existing storage pattern to follow
- `src/schemas/mergeRequestSchema.ts` - For understanding MR types

## Testing Strategy

### Unit Tests
- Event storage append/read operations
- Counter increment logic
- Event index maintenance
- Error handling (malformed events, storage failures)

### Integration Tests
- Append multiple events in sequence
- Read event ranges
- Verify eventIds are sequential
- Test concurrent appends (if needed)

## Success Criteria

- ✅ Events can be appended with auto-increment IDs
- ✅ Event counter is maintained correctly
- ✅ Events can be read individually or in ranges
- ✅ Raw API responses are preserved exactly
- ✅ Event metadata can be queried without loading raw responses
- ✅ Storage is persistent across app restarts

## Performance Considerations

- **Write Performance**: Each append = 2-3 storage writes (event + counter + index)
- **Read Performance**: Range queries efficient with index
- **Storage Size**: ~50KB per event (acceptable for unlimited retention)
- **Memory**: Events not loaded into memory except during projection

## Next Phase Dependencies

Phase 2 (Response Normalization) will:
- Read rawResponse from events
- Parse provider-specific formats
- Extract MRs for projection
