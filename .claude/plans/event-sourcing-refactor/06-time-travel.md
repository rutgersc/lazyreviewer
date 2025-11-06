# Phase 6: Time-Travel Capability

## Goal
Enable viewing MR state at any point in event history for debugging and comparison.

## Dependencies
- Phase 3 complete (projection engine)
- Phase 5 complete (filtering)

## Tasks

### Task 6.1: Historical Projection

**Project to specific event ID:**

```typescript
// src/events/timeTravel.ts

export const projectToEvent = (
  eventId: number
): Effect<Map<MRId, MergeRequest>> => {
  // Reuse existing projection function with upToEventId parameter
  return projectEvents(eventId);
};

// Get MR state at specific time
export const getMRStateAtEvent = (
  mrId: MRId,
  eventId: number
): Effect<MergeRequest | null> => {
  return Effect.gen(function* (_) {
    const mrMap = yield* _(projectToEvent(eventId));
    return mrMap.get(mrId) ?? null;
  });
};

// Get all MRs at specific time
export const getAllMRsAtEvent = (
  eventId: number
): Effect<MergeRequest[]> => {
  return Effect.gen(function* (_) {
    const mrMap = yield* _(projectToEvent(eventId));
    return Array.from(mrMap.values());
  });
};
```

**Cache historical projections (optional):**

```typescript
// Cache recent historical projections to avoid re-computing
const historicalProjectionCache = new Map<number, Map<MRId, MergeRequest>>();

export const projectToEventCached = (
  eventId: number
): Effect<Map<MRId, MergeRequest>> => {
  return Effect.gen(function* (_) {
    const cached = historicalProjectionCache.get(eventId);
    if (cached) return cached;

    const projection = yield* _(projectToEvent(eventId));
    historicalProjectionCache.set(eventId, projection);

    // Limit cache size (keep last 10)
    if (historicalProjectionCache.size > 10) {
      const firstKey = historicalProjectionCache.keys().next().value;
      historicalProjectionCache.delete(firstKey);
    }

    return projection;
  });
};
```

### Task 6.2: Event History Browser UI

**Create UI for browsing event history:**

```typescript
// src/components/EventHistoryBrowser.tsx

type EventHistoryBrowserProps = {
  onSelectEvent: (eventId: number) => void
  currentEventId: number | null
};

export const EventHistoryBrowser = ({
  onSelectEvent,
  currentEventId
}: EventHistoryBrowserProps) => {
  const events = useAtomValue(eventMetadataListAtom);
  const latestEventId = useAtomValue(lastProjectedEventIdAtom);

  return (
    <Box flexDirection="column">
      <Text bold>Event History</Text>
      <Text dimColor>Current: Event {currentEventId ?? latestEventId}</Text>

      <Box flexDirection="column" marginTop={1}>
        {events.map(event => (
          <EventRow
            key={event.eventId}
            event={event}
            isSelected={event.eventId === currentEventId}
            onSelect={() => onSelectEvent(event.eventId)}
          />
        ))}
      </Box>
    </Box>
  );
};

const EventRow = ({ event, isSelected, onSelect }) => {
  return (
    <Box>
      <Text color={isSelected ? 'cyan' : undefined}>
        {event.eventId} | {formatTimestamp(event.timestamp)} | {event.fetchType} | {formatScope(event.scope)}
      </Text>
    </Box>
  );
};
```

**Event metadata atom:**

```typescript
// src/store/timeTravelAtoms.ts

// All event metadata (without raw responses)
export const eventMetadataListAtom = atomWithEffect(Effect.gen(function* (_) {
  const latestEventId = yield* _(eventStorage.getLatestEventId());
  const metadata = yield* _(eventStorage.getEventMetadata(1, latestEventId));
  return metadata.reverse(); // Most recent first
}));

// Currently selected event for time-travel (null = current state)
export const timeTravelEventIdAtom = atom<number | null>(null);

// Projected MRs at selected event
export const timeTravelProjectionAtom = atomWithEffect(get => {
  const eventId = get(timeTravelEventIdAtom);

  if (eventId === null) {
    // Current state
    return Effect.succeed(get(projectedMRsAtom));
  } else {
    // Historical state
    return projectToEventCached(eventId);
  }
});

// Time-travel MRs as array (for UI)
export const timeTravelMRsArrayAtom = atom(get => {
  const mrMap = get(timeTravelProjectionAtom);
  return Array.from(mrMap.values()).sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
});
```

### Task 6.3: Time-Travel Mode Toggle

**Add mode toggle to UI:**

```typescript
// src/store/timeTravelAtoms.ts (extend)

// Is time-travel mode active?
export const timeTravelModeAtom = atom<boolean>(false);

// MRs to display (current or time-travel)
export const displayedMRsAtom = atom(get => {
  const timeTravelMode = get(timeTravelModeAtom);

  if (timeTravelMode) {
    // Show historical MRs (unfiltered for now)
    return get(timeTravelMRsArrayAtom);
  } else {
    // Show current filtered MRs
    return get(filteredMRsAtom);
  }
});
```

**UI integration:**

```typescript
// In main app component
const [timeTravelMode, setTimeTravelMode] = useAtom(timeTravelModeAtom);
const [selectedEventId, setSelectedEventId] = useAtom(timeTravelEventIdAtom);

// Keyboard shortcut to toggle time-travel mode
useKeyboard('t', () => {
  setTimeTravelMode(!timeTravelMode);
  if (!timeTravelMode) {
    setSelectedEventId(null); // Reset to current
  }
});

// Render event browser in time-travel mode
{timeTravelMode && (
  <EventHistoryBrowser
    onSelectEvent={setSelectedEventId}
    currentEventId={selectedEventId}
  />
)}
```

### Task 6.4: Event Statistics

**Show useful stats about events:**

```typescript
// src/events/eventStats.ts

export const getEventStats = (
  event: FetchEvent
): Effect<EventStats> => {
  return Effect.gen(function* (_) {
    const parser = getParser(event.fetchType, event.rawResponse);
    const mrs = parser.parse(event.rawResponse);

    return {
      eventId: event.eventId,
      timestamp: event.timestamp,
      fetchType: event.fetchType,
      scope: event.scope,
      mrCount: mrs.length,
      uniqueMRIds: mrs.map(getMRId)
    };
  });
};

// Compare two events
export const compareEvents = (
  eventId1: number,
  eventId2: number
): Effect<EventComparison> => {
  return Effect.gen(function* (_) {
    const projection1 = yield* _(projectToEvent(eventId1));
    const projection2 = yield* _(projectToEvent(eventId2));

    const mrIds1 = new Set(projection1.keys());
    const mrIds2 = new Set(projection2.keys());

    const added = Array.from(mrIds2).filter(id => !mrIds1.has(id));
    const removed = Array.from(mrIds1).filter(id => !mrIds2.has(id));
    const changed = Array.from(mrIds2).filter(id => {
      if (!mrIds1.has(id)) return false;
      const mr1 = projection1.get(id)!;
      const mr2 = projection2.get(id)!;
      return mr1.updatedAt !== mr2.updatedAt; // Simplified change detection
    });

    return {
      eventId1,
      eventId2,
      added,
      removed,
      changed,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length
    };
  });
};

type EventComparison = {
  eventId1: number
  eventId2: number
  added: MRId[]
  removed: MRId[]
  changed: MRId[]
  addedCount: number
  removedCount: number
  changedCount: number
};
```

**Stats display:**

```typescript
// In event history UI
const stats = useAtomValue(selectedEventStatsAtom);

<Box>
  <Text>MRs: {stats.mrCount}</Text>
  <Text>Type: {stats.fetchType}</Text>
  <Text>Scope: {formatScope(stats.scope)}</Text>
</Box>
```

## UI Layout

**Split pane layout in time-travel mode:**

```
┌─────────────────────────────────────────────────┐
│ Time-Travel Mode (Press 't' to exit)           │
├──────────────────┬──────────────────────────────┤
│ Event History    │ MR List (at selected event) │
│                  │                              │
│ [123] repo:elab  │ > MR #456: Add feature       │
│ [122] user:rutg  │   MR #457: Fix bug           │
│ [121] repo:elab  │   MR #458: Update deps       │
│ [120] single:123 │                              │
│       ...        │                              │
│                  │                              │
│ Stats:           │ Total: 42 MRs                │
│ MRs: 15          │ Viewing event 123            │
└──────────────────┴──────────────────────────────┘
```

**Keyboard shortcuts:**
- `t` - Toggle time-travel mode
- `↑/↓` - Navigate events (in time-travel mode)
- `Enter` - Select event to view
- `Esc` - Exit time-travel mode
- `d` - Show diff between selected event and current

## Files to Create/Modify

### New Files
- `src/events/timeTravel.ts` - Time-travel projection functions
- `src/events/eventStats.ts` - Event statistics and comparison
- `src/store/timeTravelAtoms.ts` - Time-travel state atoms
- `src/components/EventHistoryBrowser.tsx` - Event browser UI
- `src/components/TimeTravelMode.tsx` - Time-travel mode component

### Files to Modify
- `src/components/App.tsx` - Add time-travel mode toggle
- `src/hooks/useKeyboard.ts` - Add time-travel shortcuts

## Performance Considerations

### Projection Caching
- Cache last 10 historical projections
- Avoid re-projecting same event repeatedly
- Clear cache on new events

### Lazy Loading
- Don't load all event metadata upfront
- Paginate event list (show last 50)
- Load more on scroll

### UI Responsiveness
- Historical projection can be slow for many events
- Show loading indicator during projection
- Consider web worker for projection (future)

## Success Criteria

- ✅ Can view MR state at any event ID
- ✅ Event history browser shows all events with metadata
- ✅ Selecting event updates MR list to historical state
- ✅ Time-travel mode toggles without disrupting current state
- ✅ Event stats show useful information
- ✅ Performance: Historical projection <100ms for typical size

## Testing Strategy

### Unit Tests
- Historical projection correctness
- Event comparison logic
- Stats calculation

### Integration Tests
- Toggle time-travel mode
- Select different events, verify MR state
- Compare current vs historical state

### UI Tests
- Event browser interaction
- Keyboard shortcuts work
- Visual diff display

## Future Enhancements (Optional)

### Event Filtering
- Filter events by type (repo/user/single-mr)
- Filter by date range
- Search events by scope

### Visual Timeline
- Timeline view of events
- Show sync frequency
- Highlight busy periods

### MR Change History
- Show how specific MR changed over time
- Timeline of status updates
- Compare MR across events

### Event Replay
- Replay events from specific point
- Debug projection issues
- Test filtering on historical data

## Next Phase Dependencies

Phase 7 (Jira Integration) will:
- Work with projected MRs (current or historical)
- Fetch Jira tickets for displayed MRs
- Could extend to historical Jira data (future)
