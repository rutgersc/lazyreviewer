# Phase 7: Jira Integration Update

## Goal
Adapt Jira ticket fetching to work with projected MRs instead of user-selection-based fetching.

## Dependencies
- Phase 3 complete (projected MRs)
- Phase 5 complete (filtered MRs)

## Tasks

### Task 7.1: Jira Fetching for Projected MRs

**Fetch Jira tickets for all projected MRs:**

```typescript
// src/jira/jiraProjectionIntegration.ts

export const fetchJiraForProjectedMRs = (): Effect<Map<string, JiraIssue>> => {
  return Effect.gen(function* (_) {
    // 1. Get all projected MRs (current state)
    const mrMap = yield* _(projectedMRsAtom.get);
    const mrs = Array.from(mrMap.values());

    // 2. Extract unique Jira keys from all MRs
    const jiraKeys = extractUniqueJiraKeys(mrs);

    if (jiraKeys.length === 0) {
      return new Map();
    }

    yield* _(Effect.logInfo(`Fetching ${jiraKeys.length} Jira tickets...`));

    // 3. Batch fetch Jira tickets (existing logic)
    const tickets = yield* _(loadJiraTickets(jiraKeys));

    // 4. Return as map for easy lookup
    return new Map(tickets.map(t => [t.key, t]));
  });
};

// Extract unique Jira keys from MRs
const extractUniqueJiraKeys = (mrs: MergeRequest[]): string[] => {
  const keysSet = new Set<string>();

  for (const mr of mrs) {
    for (const key of mr.jiraIssueKeys) {
      keysSet.add(key);
    }
  }

  return Array.from(keysSet);
};
```

**Jira state atom:**

```typescript
// src/store/jiraAtoms.ts

// Map of Jira key → Jira issue
export const jiraTicketsAtom = atom<Map<string, JiraIssue>>(new Map());

// Loading state
export const jiraLoadingAtom = atom<boolean>(false);

// Fetch and update Jira tickets
export const fetchAndUpdateJiraTickets = (): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(jiraLoadingAtom.set(true));

    try {
      const tickets = yield* _(fetchJiraForProjectedMRs());
      yield* _(jiraTicketsAtom.set(tickets));
    } finally {
      yield* _(jiraLoadingAtom.set(false));
    }
  });
};

// Get Jira ticket for specific key
export const getJiraTicket = (key: string): JiraIssue | undefined => {
  return jiraTicketsAtom.get().get(key);
};
```

### Task 7.2: Trigger Jira Fetch After Projection

**Automatically fetch Jira after MR sync:**

```typescript
// src/events/projection.ts (modify)

export const updateProjection = (): Effect<void> => {
  return Effect.gen(function* (_) {
    // ... existing projection logic ...

    // After projection completes, fetch Jira tickets
    yield* _(fetchAndUpdateJiraTickets());
  });
};
```

**Or, better: Separate manual trigger:**

```typescript
// src/sync/syncOrchestrator.ts (modify)

export const syncAll = (): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(setSyncInProgress(true));

    try {
      // 1. Sync MRs (repos + users)
      yield* _(Effect.all([
        syncConfiguredRepos(),
        syncConfiguredUsers()
      ]));

      // 2. Fetch Jira tickets for all synced MRs
      yield* _(fetchAndUpdateJiraTickets());

      yield* _(Effect.logInfo('Full sync completed (MRs + Jira)'));
    } finally {
      yield* _(setSyncInProgress(false));
    }
  });
};
```

### Task 7.3: Jira Ticket Lookup in UI

**Use Jira atom in components:**

```typescript
// In MR detail view or modal
const jiraTickets = useAtomValue(jiraTicketsAtom);
const jiraLoading = useAtomValue(jiraLoadingAtom);

const mr = useAtomValue(selectedMRAtom);
const mrJiraTickets = mr.jiraIssueKeys
  .map(key => jiraTickets.get(key))
  .filter(Boolean);

// Render Jira tickets
{mrJiraTickets.map(ticket => (
  <JiraTicketDisplay key={ticket.key} ticket={ticket} />
))}
```

**Existing UI components should work as-is:**
- MR list shows Jira keys (from MR data)
- Jira modal shows ticket details (from jiraTicketsAtom)
- No changes to UI logic needed

### Task 7.4: Jira Events (Optional Enhancement)

**Store Jira fetches as events too:**

```typescript
// src/events/eventTypes.ts (extend)

type FetchEvent =
  | MRFetchEvent
  | JiraFetchEvent;

type JiraFetchEvent = {
  eventId: number
  timestamp: Date
  fetchType: 'jira'
  scope: { type: 'jira', keys: string[] }
  rawResponse: unknown  // Raw Jira API response
};

// Append Jira fetch event
export const appendJiraFetchEvent = (
  keys: string[],
  rawResponse: unknown
): Effect<number> => {
  return appendEvent({
    timestamp: new Date(),
    fetchType: 'jira',
    scope: { type: 'jira', keys },
    rawResponse
  });
};
```

**Jira projection:**

```typescript
// src/jira/jiraProjection.ts

export const projectJiraEvents = (
  upToEventId?: number
): Effect<Map<string, JiraIssue>> => {
  return Effect.gen(function* (_) {
    const events = yield* _(eventStorage.getAllEvents());

    // Filter only Jira events
    const jiraEvents = events.filter(e => e.fetchType === 'jira');

    const ticketMap = new Map<string, JiraIssue>();

    for (const event of jiraEvents) {
      const parser = JiraResponseParser;
      const tickets = parser.parse(event.rawResponse);

      for (const ticket of tickets) {
        // Last-write-wins
        const existing = ticketMap.get(ticket.key);
        if (!existing || event.timestamp > getTimestamp(existing)) {
          ticketMap.set(ticket.key, ticket);
        }
      }
    }

    return ticketMap;
  });
};
```

**Benefits of Jira events:**
- Historical Jira data preserved
- Can see how Jira tickets changed over time
- Time-travel mode includes Jira state
- Complete audit trail

**Complexity:**
- Additional parser needed
- Jira projection logic
- More storage used

**Decision:** Implement if time-travel for Jira is valuable, otherwise skip for now.

## Deduplication Improvement

**Current Jira fetching already deduplicates:**

```typescript
// Existing logic in jiraService.ts (good!)
const jiraKeys = Array.from(new Set(mrs.flatMap(mr => mr.jiraIssueKeys)));
```

**With projected MRs, deduplication is even better:**
- Fetch Jira once for all projected MRs
- Not per user selection anymore
- Significant API call reduction

**Example:**
- Old: 3 user selections × 30 MRs = fetch Jira keys 3 times (even if overlap)
- New: 1 projection × 30 unique MRs = fetch Jira keys 1 time

## Files to Create/Modify

### New Files
- `src/jira/jiraProjectionIntegration.ts` - Jira fetching for projected MRs
- `src/store/jiraAtoms.ts` - Jira state atoms
- `src/jira/jiraProjection.ts` - Jira event projection (optional)

### Files to Modify
- `src/events/projection.ts` - Trigger Jira fetch after projection (or)
- `src/sync/syncOrchestrator.ts` - Add Jira fetch to sync flow
- `src/jira/jiraService.ts` - Adapt to use projected MRs

### Files to Keep As-Is
- Existing Jira UI components (already use atoms/state)
- Jira API client (no changes needed)

## Jira Fetch Strategies

**Strategy 1: Fetch on every projection update**
- Pros: Always up-to-date
- Cons: Many API calls if syncing frequently

**Strategy 2: Fetch on manual sync only**
- Pros: User controls when Jira is fetched
- Cons: Jira data may be stale

**Strategy 3: Smart fetch (detect new Jira keys)**
- Pros: Only fetch when new keys appear
- Cons: More complex logic

**Recommendation:** Strategy 2 (manual sync) for now, can add auto-refresh later.

## Performance Considerations

### Jira API Rate Limits
- Jira Cloud: 300 requests per minute per user
- Batch fetching (current approach) is efficient
- Typical: 1 request for 50 keys (JQL query)

### Fetch Time
- Jira API: ~500ms-1s per request
- Parallel with MR sync (don't block UI)
- Show loading indicator

### Caching
- Jira tickets cached in atom
- Persist to storage (optional)
- TTL could be added (e.g., 5 minutes)

## Error Handling

### Jira API Failures
- Log error but don't crash app
- Show MRs without Jira data
- Retry button in UI

### Missing Jira Credentials
- Gracefully skip Jira fetch
- Show warning if configured but failing

### Invalid Jira Keys
- API returns errors for invalid keys
- Filter out errors, show valid tickets

## Success Criteria

- ✅ Jira tickets fetched for all projected MRs
- ✅ Deduplication works (unique keys only)
- ✅ Jira data available in UI components
- ✅ Fetch triggered after MR sync
- ✅ Loading states displayed correctly
- ✅ Errors handled gracefully
- ✅ Reduced Jira API calls vs. old approach

## Testing Strategy

### Unit Tests
- Extract unique Jira keys from MRs
- Jira ticket lookup by key
- Error handling (API failures)

### Integration Tests
- Sync MRs → verify Jira fetched
- Update projection → verify Jira updated
- Jira atom populated correctly

### UI Tests
- MR list shows Jira keys
- Jira modal displays ticket details
- Loading indicators work

## Migration Notes

**Existing Jira code reusable:**
- `loadJiraTickets()` function unchanged
- Jira API client unchanged
- UI components mostly unchanged

**Changes needed:**
- Remove per-user-selection Jira fetch
- Use projected MRs as source
- Fetch once for all MRs

**Backward compatibility:**
- Jira modal still works same way
- No UI changes required
- Just change data source

## Next Phase Dependencies

Phase 8 (Migration & Cleanup) will:
- Remove old MR fetch logic
- Clean up old cache structures
- Finalize Jira integration
- Complete refactoring
