# Phase 3: Projection Engine

## Goal
Calculate current MR state by projecting event history into a normalized Map<MRId, MergeRequest>.

## Dependencies
- Phase 1 complete (event storage)
- Phase 2 complete (parsers and MR identity)

## Tasks

### Task 3.1: Core Projection Function

**Main projection logic:**

```typescript
// src/events/projection.ts

export const projectEvents = (
  upToEventId?: number
): Effect<Map<MRId, MergeRequest>> => {
  return Effect.gen(function* (_) {
    // 1. Load events from storage
    const events = upToEventId
      ? yield* _(eventStorage.getEvents(1, upToEventId))
      : yield* _(eventStorage.getAllEvents());

    // 2. Project events into MR map
    const mrMap = new Map<MRId, MergeRequest>();

    for (const event of events) {
      yield* _(projectSingleEvent(event, mrMap));
    }

    return mrMap;
  });
};

const projectSingleEvent = (
  event: FetchEvent,
  mrMap: Map<MRId, MergeRequest>
): Effect<void> => {
  return Effect.gen(function* (_) {
    try {
      // 1. Parse raw response to MRs
      const parser = getParser(event.fetchType, event.rawResponse);
      const mrs = parser.parse(event.rawResponse);

      // 2. Update map with last-write-wins
      for (const mr of mrs) {
        const mrId = getMRId(mr);

        // Check if we already have this MR from earlier event
        const existing = mrMap.get(mrId);

        if (!existing || event.timestamp > getTimestamp(existing)) {
          // This event is newer, update the map
          mrMap.set(mrId, enrichMRWithMetadata(mr, event));
        }
      }
    } catch (error) {
      // Log parse error but continue projection
      yield* _(Effect.logError(`Failed to project event ${event.eventId}`, error));
    }
  });
};

// Attach event metadata to MR for debugging
const enrichMRWithMetadata = (
  mr: MergeRequest,
  event: FetchEvent
): MergeRequest => {
  return {
    ...mr,
    _metadata: {
      lastUpdatedFromEventId: event.eventId,
      lastUpdatedAt: event.timestamp,
      fetchType: event.fetchType
    }
  };
};
```

**Last-Write-Wins Logic:**
- Compare event.timestamp to existing MR timestamp
- Newer timestamp always wins
- If same timestamp (rare), later eventId wins

### Task 3.2: Incremental Projection Cache

**Optimize projection performance:**

```typescript
// src/events/projectionCache.ts

type ProjectionCache = {
  mrMap: Map<MRId, MergeRequest>    // Current projected state
  lastProjectedEventId: number       // Last event included in projection
};

// Service for managing projection cache
export const ProjectionCacheService = {
  // Load cache from storage
  loadCache(): Effect<ProjectionCache | null>,

  // Save cache to storage
  saveCache(cache: ProjectionCache): Effect<void>,

  // Project incrementally from cache
  projectIncremental(
    cache: ProjectionCache,
    fromEventId: number
  ): Effect<ProjectionCache>
};

// Incremental projection implementation
export const projectIncremental = (
  currentCache: ProjectionCache,
  fromEventId: number
): Effect<ProjectionCache> => {
  return Effect.gen(function* (_) {
    const latestEventId = yield* _(eventStorage.getLatestEventId());

    if (fromEventId > latestEventId) {
      // Already up to date
      return currentCache;
    }

    // Load only new events since last projection
    const newEvents = yield* _(
      eventStorage.getEvents(fromEventId + 1, latestEventId)
    );

    // Start with existing map
    const mrMap = new Map(currentCache.mrMap);

    // Project only new events
    for (const event of newEvents) {
      yield* _(projectSingleEvent(event, mrMap));
    }

    return {
      mrMap,
      lastProjectedEventId: latestEventId
    };
  });
};
```

**Cache Strategy:**
- In-memory cache (atom) for instant access
- Persistent backup for app restart
- Invalidate on sync (project new events)
- Full rebuild if cache corrupted

### Task 3.3: MR State Atoms

**Create state management for projected MRs:**

```typescript
// src/store/projectionAtoms.ts

// Current projection cache (in-memory)
export const projectionCacheAtom = atom<ProjectionCache | null>(null);

// Derived: current MR map (easy access)
export const projectedMRsAtom = atom(get => {
  const cache = get(projectionCacheAtom);
  return cache?.mrMap ?? new Map<MRId, MergeRequest>();
});

// Derived: MR array for UI (sorted)
export const projectedMRsArrayAtom = atom(get => {
  const mrMap = get(projectedMRsAtom);
  return Array.from(mrMap.values()).sort((a, b) => {
    // Sort by updated date descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
});

// Last projected event ID (for incremental updates)
export const lastProjectedEventIdAtom = atom(get => {
  const cache = get(projectionCacheAtom);
  return cache?.lastProjectedEventId ?? 0;
});

// Projection in progress flag
export const projectionLoadingAtom = atom<boolean>(false);
```

**Projection Update Flow:**

```typescript
// src/store/projectionEffects.ts

export const updateProjection = (): Effect<void> => {
  return Effect.gen(function* (_) {
    const currentCache = yield* _(projectionCacheAtom.get);
    const latestEventId = yield* _(eventStorage.getLatestEventId());

    if (!currentCache || currentCache.lastProjectedEventId < latestEventId) {
      // Need to project new events
      yield* _(projectionLoadingAtom.set(true));

      const updatedCache = currentCache
        ? yield* _(projectIncremental(currentCache, currentCache.lastProjectedEventId))
        : yield* _(projectFromScratch());

      yield* _(projectionCacheAtom.set(updatedCache));
      yield* _(ProjectionCacheService.saveCache(updatedCache));
      yield* _(projectionLoadingAtom.set(false));
    }
  });
};

const projectFromScratch = (): Effect<ProjectionCache> => {
  return Effect.gen(function* (_) {
    const mrMap = yield* _(projectEvents());
    const latestEventId = yield* _(eventStorage.getLatestEventId());

    return { mrMap, lastProjectedEventId: latestEventId };
  });
};
```

### Task 3.4: Automatic Projection Updates

**Trigger projection after events appended:**

```typescript
// src/events/eventAppenders.ts (update)

export const appendRepoFetchEvent = (
  repoId: string,
  rawResponse: unknown
): Effect<number> => {
  return Effect.gen(function* (_) {
    // 1. Append event
    const eventId = yield* _(appendEvent({
      timestamp: new Date(),
      fetchType: 'repo',
      scope: { type: 'repo', repoId },
      rawResponse
    }));

    // 2. Trigger projection update
    yield* _(updateProjection());

    return eventId;
  });
};

// Same for other append functions
```

## Files to Create/Modify

### New Files
- `src/events/projection.ts` - Core projection logic
- `src/events/projectionCache.ts` - Cache management
- `src/store/projectionAtoms.ts` - State atoms for projection
- `src/store/projectionEffects.ts` - Projection update effects

### Files to Modify
- `src/events/eventAppenders.ts` - Add projection trigger
- `src/schemas/mergeRequestSchema.ts` - Add optional `_metadata` field

## Performance Optimizations

### Incremental Projection
- Only project new events since last cache
- Typical: 1-5 new events = ~5-10ms
- Avoid full projection except on init or cache miss

### Memory Management
- MR map stored in memory (~150 MRs × 15KB = 2.25MB)
- Acceptable for modern machines
- Could add LRU cache if needed

### Projection Batching
- If multiple events appended rapidly, batch projection
- Debounce projection updates (e.g., 100ms)
- Avoid projecting for every single event

```typescript
// Debounced projection
let projectionTimeout: NodeJS.Timeout | null = null;

export const scheduleProjectionUpdate = (): Effect<void> => {
  return Effect.sync(() => {
    if (projectionTimeout) clearTimeout(projectionTimeout);

    projectionTimeout = setTimeout(() => {
      Effect.runPromise(updateProjection());
    }, 100);
  });
};
```

## Error Handling

### Parse Errors
- Log error with event ID
- Skip problematic event
- Continue projection (don't crash)

### Storage Errors
- Retry with exponential backoff
- Fall back to in-memory projection
- Alert user if persistent

### Cache Corruption
- Detect inconsistency (missing events, gaps)
- Rebuild from scratch
- Log warning

## Success Criteria

- ✅ Projection produces correct current state from events
- ✅ Last-write-wins works across fetch types
- ✅ Incremental projection works (only new events)
- ✅ Cache survives app restart
- ✅ Projection updates automatically after event append
- ✅ Parse errors don't crash projection
- ✅ Performance: <10ms for typical incremental update

## Testing Strategy

### Unit Tests
- Projection with multiple events (verify last-write-wins)
- Incremental projection correctness
- Timestamp comparison logic
- Parse error handling

### Integration Tests
- Append events → verify projection updates
- App restart → verify cache loaded
- Concurrent updates

### Performance Tests
- Project 100 events (should be <50ms)
- Incremental update 5 events (should be <10ms)

## Next Phase Dependencies

Phase 4 (Multi-Strategy Sync) will:
- Use event append functions to store fetches
- Trigger projection automatically
- UI consumes `projectedMRsAtom`
