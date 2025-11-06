# Phase 8: Migration & Cleanup

## Goal
Migrate existing data to event-sourced architecture and remove legacy code.

## Dependencies
- All previous phases complete (1-7)
- New system fully functional and tested

## Tasks

### Task 8.1: Data Migration

**Migrate existing cache to events:**

```typescript
// src/migration/cacheToEvents.ts

export const migrateOldCacheToEvents = (): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(Effect.logInfo('Starting cache migration...'));

    // 1. Check if migration already done
    const migrationComplete = yield* _(getMigrationFlag());
    if (migrationComplete) {
      yield* _(Effect.logInfo('Migration already completed'));
      return;
    }

    // 2. Load all old cache entries
    const oldCache = yield* _(loadOldCacheEntries());

    if (oldCache.length === 0) {
      yield* _(Effect.logInfo('No old cache data to migrate'));
      yield* _(setMigrationFlag(true));
      return;
    }

    yield* _(Effect.logInfo(`Found ${oldCache.length} cache entries to migrate`));

    // 3. Convert each cache entry to event
    for (const entry of oldCache) {
      yield* _(migrateCacheEntry(entry));
    }

    // 4. Mark migration complete
    yield* _(setMigrationFlag(true));

    yield* _(Effect.logInfo('Cache migration completed'));
  });
};

// Load old cache entries from storage
const loadOldCacheEntries = (): Effect<OldCacheEntry[]> => {
  return Effect.gen(function* (_) {
    const storage = yield* _(MergeRequestStorage);
    const allKeys = yield* _(storage.keys());

    // Filter keys that match old cache format: "mrs_*"
    const cacheKeys = allKeys.filter(k => k.startsWith('mrs_'));

    const entries: OldCacheEntry[] = [];

    for (const key of cacheKeys) {
      const data = yield* _(storage.get(key));
      if (data) {
        entries.push({
          key,
          data: data.data,
          timestamp: data.timestamp || new Date()
        });
      }
    }

    return entries;
  });
};

type OldCacheEntry = {
  key: string             // e.g., "mrs_opened_r.schoorstra_gitlab"
  data: MergeRequest[]
  timestamp: Date
};

// Convert cache entry to event
const migrateCacheEntry = (entry: OldCacheEntry): Effect<void> => {
  return Effect.gen(function* (_) {
    // Parse cache key to determine fetch type and scope
    const { fetchType, scope } = parseCacheKey(entry.key);

    // Create synthetic raw response
    const rawResponse = createSyntheticResponse(entry.data, fetchType);

    // Append as migration event
    yield* _(appendEvent({
      timestamp: entry.timestamp,
      fetchType,
      scope,
      rawResponse
    }));

    yield* _(Effect.logInfo(`Migrated cache entry: ${entry.key}`));
  });
};

// Parse old cache key format
const parseCacheKey = (key: string): { fetchType: FetchType, scope: FetchScope } => {
  // Format: "mrs_{state}_{usernames/project}_gitlab"
  // Examples:
  // - "mrs_opened_r.schoorstra_gitlab" → user fetch
  // - "mrs_opened_elab_elab_gitlab" → repo fetch

  const parts = key.split('_');
  const state = parts[1]; // "opened", "merged", etc.
  const identifiers = parts.slice(2, -1); // ["r.schoorstra"] or ["elab", "elab"]

  // Heuristic: if single identifier with dot, it's a user; otherwise repo
  if (identifiers.length === 1 && identifiers[0].includes('.')) {
    return {
      fetchType: 'user',
      scope: { type: 'user', username: identifiers[0] }
    };
  } else {
    const repoPath = identifiers.join('/');
    return {
      fetchType: 'repo',
      scope: { type: 'repo', repoId: `gitlab:${repoPath}` }
    };
  }
};

// Create synthetic raw response from normalized data
const createSyntheticResponse = (
  mrs: MergeRequest[],
  fetchType: FetchType
): unknown => {
  // Create response in GraphQL format (most common)
  return {
    data: {
      mergeRequests: {
        nodes: mrs.map(mr => ({
          // Map back to GraphQL format
          // This is approximate since we've lost original response
          id: mr.id,
          iid: mr.iid,
          title: mr.title,
          // ... map all fields
          __synthetic: true // Mark as migrated data
        }))
      }
    }
  };
};

// Migration flag in settings
const getMigrationFlag = (): Effect<boolean> => {
  return Effect.gen(function* (_) {
    const settings = yield* _(loadSettings());
    return settings.cacheToEventsMigrationComplete ?? false;
  });
};

const setMigrationFlag = (complete: boolean): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(updateSettings({
      cacheToEventsMigrationComplete: complete
    }));
  });
};
```

**Run migration on app startup:**

```typescript
// src/index.tsx or main app initialization

const initializeApp = (): Effect<void> => {
  return Effect.gen(function* (_) {
    // Run migration before loading app
    yield* _(migrateOldCacheToEvents());

    // Load initial projection
    yield* _(updateProjection());

    // Fetch Jira tickets
    yield* _(fetchAndUpdateJiraTickets());

    yield* _(Effect.logInfo('App initialized'));
  });
};
```

### Task 8.2: Remove Old Code

**Delete legacy files:**

```typescript
// Files to remove:
// - src/mergerequests/mergerequests-caching-effects.ts
// - src/store/cacheKeyGeneration.ts (old cache key logic)
// - Any other cache-specific utilities

// Commands to run:
// git rm src/mergerequests/mergerequests-caching-effects.ts
// git rm src/store/cacheKeyGeneration.ts
```

**Remove old fetch orchestration:**

```typescript
// src/mergerequests/mergerequests-effects.ts (refactor heavily)

// Remove:
// - fetchMergeRequests() (user-based fetch)
// - Cache key generation
// - Clear-delay-set pattern

// Keep (but adapt):
// - API client functions (now return raw responses)
// - Error handling
// - Logging
```

**Remove old atoms:**

```typescript
// src/store/appAtoms.ts (clean up)

// Remove:
// - mrsCacheByKeyAtomFamily
// - Old cache-related atoms
// - User-selection-based fetch triggers

// Keep:
// - UI state atoms (selected MR, etc.)
// - Settings atoms
// - Derived atoms (refactored to use projection)
```

### Task 8.3: Clean Old Storage Keys

**Remove old cache from persistent storage:**

```typescript
// src/migration/cleanupOldStorage.ts

export const cleanupOldStorageKeys = (): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(Effect.logInfo('Cleaning up old storage keys...'));

    const storage = yield* _(MergeRequestStorage);
    const allKeys = yield* _(storage.keys());

    // Remove all old cache keys
    const oldKeys = allKeys.filter(k =>
      k.startsWith('mrs_') ||
      k.startsWith('cache_')
    );

    for (const key of oldKeys) {
      yield* _(storage.remove(key));
    }

    yield* _(Effect.logInfo(`Removed ${oldKeys.length} old storage keys`));
  });
};
```

**Run cleanup after migration:**

```typescript
// In migration script
yield* _(migrateOldCacheToEvents());
yield* _(cleanupOldStorageKeys());
```

**Optional: Keep old cache temporarily for rollback:**

```typescript
// Add flag to delay cleanup
const settings = yield* _(loadSettings());
if (settings.deleteOldCacheAfterMigration) {
  yield* _(cleanupOldStorageKeys());
} else {
  yield* _(Effect.logInfo('Old cache preserved (set deleteOldCacheAfterMigration to clean)'));
}
```

### Task 8.4: Update Documentation

**Update CLAUDE.md:**

```markdown
# CLAUDE.md (updated sections)

## Architecture

### Event-Sourced MR Storage

LazyGitLab uses event sourcing for MR data:

1. **Event Stream**: All fetches (repo/user/single-MR) stored as immutable events
2. **Projection**: Current MR state calculated from event history
3. **Time-Travel**: View MR state at any point in history

**Event Types:**
- `repo`: Fetch all MRs in repository
- `user`: Fetch all MRs by author
- `single-mr`: Refresh individual MR

**Data Flow:**
```
Fetch → Append Event → Update Projection → Filter by User Selection → Render
```

**Key Files:**
- `src/events/eventStorage.ts` - Event log storage
- `src/events/projection.ts` - Projection engine
- `src/sync/` - Sync strategies
- `src/filtering/` - Filter logic

### User Selections as Filters

User selections no longer trigger fetches. Instead:
1. All configured repos/users are synced
2. User selections filter projected MRs client-side
3. Switching selections is instant (no API call)

### State Management

**Single Source of Truth:**
- Event stream (persistent)
- Projected MRs (derived from events)
- Filtered MRs (derived from projection)

**No Duplication:**
- Each MR stored once (in projection)
- User selections share same data
- Jira tickets fetched once for all MRs
```

**Add architecture diagram:**

```markdown
## Architecture Diagram

```
                      ┌─────────────────┐
                      │  GitLab/Bitbucket│
                      │      APIs       │
                      └────────┬────────┘
                               │ fetch
                               ▼
                      ┌─────────────────┐
                      │  Sync Strategies│
                      │ (repo/user/MR)  │
                      └────────┬────────┘
                               │ append
                               ▼
                      ┌─────────────────┐
                      │  Event Stream   │◄──── Time-Travel
                      │ (append-only)   │
                      └────────┬────────┘
                               │ project
                               ▼
                      ┌─────────────────┐
                      │   Projection    │
                      │ Map<MRId, MR>   │
                      └────────┬────────┘
                               │ filter
                               ▼
                      ┌─────────────────┐
                      │ User Selection  │
                      │    Filters      │
                      └────────┬────────┘
                               │ render
                               ▼
                      ┌─────────────────┐
                      │   UI (TUI)      │
                      └─────────────────┘
```
```

**Update type-driven development section:**

```markdown
### Event-Sourced Development

When working with events and projections:

1. **Events are immutable**: Never modify event data
2. **Raw responses preserved**: Events store exact API responses
3. **Projection derives state**: Current state = f(events)
4. **Last-write-wins**: Later events override earlier ones
5. **Parsers normalize**: Convert raw → unified schema

**Adding new sync type:**
1. Define event scope type
2. Create appender function
3. Implement parser for raw response
4. Add to projection logic
```

### Task 8.5: Update Tests

**Refactor tests to use events:**

```typescript
// Old test approach:
describe('fetchMergeRequests', () => {
  it('should cache MRs by user selection', async () => {
    const mrs = await fetchMergeRequests('r.schoorstra');
    expect(cache.get('mrs_opened_r.schoorstra_gitlab')).toEqual(mrs);
  });
});

// New test approach:
describe('syncUser', () => {
  it('should append event and update projection', async () => {
    const eventId = await syncUser('r.schoorstra');

    expect(eventId).toBeGreaterThan(0);

    const event = await getEvent(eventId);
    expect(event.fetchType).toBe('user');
    expect(event.scope).toEqual({ type: 'user', username: 'r.schoorstra' });

    const projection = await projectEvents();
    expect(projection.size).toBeGreaterThan(0);
  });
});
```

**Add projection tests:**

```typescript
describe('Projection', () => {
  it('should apply last-write-wins', async () => {
    // Append two events with same MR
    await appendEvent({ /* MR v1 */, timestamp: new Date('2024-01-01') });
    await appendEvent({ /* MR v2 */, timestamp: new Date('2024-01-02') });

    const projection = await projectEvents();
    const mr = projection.get(mrId);

    // Should have v2 data (newer timestamp)
    expect(mr.title).toBe('MR v2 title');
  });

  it('should project incrementally', async () => {
    const initialProjection = await projectEvents(10);
    expect(initialProjection.size).toBe(50);

    // Append new event
    await appendEvent({ /* new MR */ });

    const incrementalProjection = await projectIncremental(initialProjection, 10);
    expect(incrementalProjection.size).toBe(51);
  });
});
```

### Task 8.6: Performance Validation

**Benchmark new vs. old architecture:**

```typescript
// src/benchmarks/migrationBenchmark.ts

export const benchmarkArchitectures = async () => {
  console.log('Benchmarking old vs. new architecture...');

  // Old: User selection switch
  const oldSwitchTime = await benchmark(() => {
    switchUserSelectionOld(1);
  });

  // New: User selection switch (filter only)
  const newSwitchTime = await benchmark(() => {
    switchUserSelection(1);
  });

  console.log(`Old switch time: ${oldSwitchTime}ms`);
  console.log(`New switch time: ${newSwitchTime}ms`);
  console.log(`Improvement: ${((oldSwitchTime - newSwitchTime) / oldSwitchTime * 100).toFixed(1)}%`);

  // Projection performance
  const projectionTime = await benchmark(() => {
    projectEvents();
  });
  console.log(`Full projection time: ${projectionTime}ms`);

  // Incremental projection
  const incrementalTime = await benchmark(() => {
    projectIncremental(cache, lastEventId);
  });
  console.log(`Incremental projection time: ${incrementalTime}ms`);
};
```

**Expected results:**
- Old switch time: ~1000-2000ms (fetch + delay)
- New switch time: <1ms (filter only)
- Improvement: >99%
- Full projection: <50ms (100 events)
- Incremental: <10ms (1-5 events)

## Migration Checklist

- [ ] Migration script created
- [ ] Old cache data migrated to events
- [ ] Migration flag set in settings
- [ ] Old code removed (effects, cache logic, atoms)
- [ ] Old storage keys cleaned up
- [ ] Documentation updated (CLAUDE.md)
- [ ] Tests refactored to new architecture
- [ ] Performance validated (benchmarks)
- [ ] UI works with new atoms
- [ ] No regressions (all features work)
- [ ] Rollback plan tested (just in case)

## Rollback Plan

**If issues found after migration:**

1. Keep old code temporarily (comment out, don't delete)
2. Add feature flag to switch between old/new
3. Can revert to old cache if events broken
4. Gradual cutover per user selection

```typescript
// Feature flag approach
const USE_EVENT_SOURCING = true;

const mrs = USE_EVENT_SOURCING
  ? get(filteredMRsAtom)      // New
  : get(mergeRequestsAtom);   // Old
```

## Success Criteria

- ✅ All old cache data migrated to events
- ✅ Old code removed (cache, fetch orchestration)
- ✅ Storage cleaned (old keys removed)
- ✅ Documentation updated
- ✅ Tests pass (refactored to events)
- ✅ Performance improved (benchmarks show gains)
- ✅ No regressions (all features work)
- ✅ User experience improved (faster switching)

## Final Verification

**Manual testing checklist:**

1. App starts successfully
2. Initial sync fetches MRs
3. MR list displays correctly
4. User selection switching is instant
5. Jira tickets load
6. Single MR refresh works
7. Time-travel mode works
8. No console errors
9. Settings persist
10. App restart preserves state

**Performance checks:**

- Selection switching: <1ms
- Initial load: <10s
- Projection update: <100ms
- Memory usage: <50MB
- Storage size: reasonable

## Post-Migration Tasks

**Optional enhancements:**

1. Add event compaction (merge historical events)
2. Add TTL for old events (if unlimited retention too much)
3. Export/import events (backup/restore)
4. Event analytics (sync frequency, fetch patterns)
5. Visual event timeline in UI

**Monitoring:**

- Track event count over time
- Monitor projection performance
- Watch storage size growth
- Alert on projection errors

## Completion

Once all tasks complete and verification passes:

1. Create PR with all changes
2. Document breaking changes (if any)
3. Update changelog
4. Merge to main
5. Tag release: `v2.0.0-event-sourcing`
6. Celebrate! 🎉

**This completes the event-sourcing refactor.**
