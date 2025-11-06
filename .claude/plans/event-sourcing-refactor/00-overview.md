# Event-Sourced MR Sync Architecture - Overview

## Summary
Refactor LazyGitLab from user-centric fetching with duplication to an event-sourcing architecture where all fetches are stored as immutable events. Current MR state is calculated via projection from event history.

## Problem Statement

### Current Architecture Issues
1. **Duplicate Fetching**: Same MR fetched multiple times when it appears in multiple user selections
   - Example: r.schoorstra's MR appears in "r.schoorstra", "florenceBE", and "team florence" selections
   - Each selection has separate cache entry with full MR data

2. **Cache Explosion**: Separate cache for every user/group combination
   - Current: 10 selections = 10+ cache keys
   - Potential: n users = 2^n - 1 combinations

3. **Incomplete Visibility**: User-based queries miss MRs from other authors in same repo

4. **Architectural Mismatch**: GitLab (user-centric) vs Bitbucket (repo-centric)

5. **No Historical Data**: Can't compare current state vs previous, no diffing capability

## Solution: Event Sourcing + Projection

### Core Concepts

**Event Stream (Source of Truth)**
- Append-only log of all fetches
- Each event = raw API response + metadata
- Auto-incrementing eventId (1, 2, 3, ...)
- Immutable - never modified or deleted
- Unlimited retention

**Projection (Derived State)**
- Current MR state = projection of event history
- Map<MRId, MergeRequest> normalized by unique MR ID
- Last-write-wins based on event timestamp
- Cached incrementally (only project new events)

**Multiple Sync Strategies**
- Repository sync: fetch all MRs in repo
- User sync: fetch all MRs by author
- Single MR refresh: update individual MR
- All append to same event stream

**Filtering (Not Fetching)**
- User selections become client-side filters
- No fetching on selection switch
- Filter projected state by author/repo

## Design Decisions

### Event Schema
```typescript
type FetchEvent = {
  eventId: number              // Auto-increment: 1, 2, 3, ...
  timestamp: Date              // When fetch occurred
  fetchType: 'repo' | 'user' | 'single-mr'
  scope: FetchScope           // What was fetched
  rawResponse: unknown        // Exact API response (GraphQL/REST)
}

type FetchScope =
  | { type: 'repo', repoId: string }
  | { type: 'user', username: string }
  | { type: 'single-mr', mrId: string }
```

### MR Unique Identity
```typescript
type MRId = string  // Format: "gitlab:elab/elab:123" or "bitbucket:workspace/repo:456"
```
- Provider prefix ensures uniqueness across GitLab/Bitbucket
- Same MR always maps to same ID regardless of fetch strategy

### Conflict Resolution
- **Last-write-wins**: Event with latest timestamp determines MR state
- Applies across all fetch types
- No complex merging logic needed

### Storage Strategy
- **Event storage**: Persistent (Effect KeyValueStore)
- **Projection cache**: In-memory atom + persistent backup
- **EventId counter**: Persistent setting

## Benefits

### Performance
- ✅ No duplicate MR storage (normalized per-MR)
- ✅ Incremental projection (only new events)
- ✅ Instant selection switching (no fetch)
- ✅ Reduced Jira API calls (batch across all MRs)

### Features
- ✅ Time-travel: view state at any event
- ✅ Historical comparison: diff between points in time
- ✅ Complete repo visibility: see all MRs, not just by selected authors
- ✅ Flexible sync: repo/user/single-MR all work together
- ✅ Audit trail: every fetch preserved

### Architecture
- ✅ Single source of truth (event stream)
- ✅ Immutable data (append-only)
- ✅ Testable (replay events for any state)
- ✅ Future-proof (can add analytics, ML, etc.)

## Implementation Phases (Correct Order)

**IMPORTANT: Phases must be implemented in dependency order!**

1. **Raw Fetch Methods & Response Types** - Create fetch functions that return raw API responses, define TypeScript types for each response
2. **Event Stream Storage** - Append-only log with auto-increment IDs (using response types from Phase 1)
3. **Response Normalization** - Parse raw API responses to unified schema
4. **Projection Engine** - Calculate current state from events
5. **Multi-Strategy Sync** - Repo/user/single-MR sync implementations
6. **Filtering & User Selections** - Client-side filtering of projected state
7. **Time-Travel** - Historical projection and UI
8. **Jira Integration** - Adapt to work with projected MRs
9. **Migration & Cleanup** - Migrate old data, remove legacy code

### Why This Order?

**Phase 1 must come first** because:
- We need to know the exact structure of API responses before designing event storage
- TypeScript types from raw responses are used in event definitions
- Event storage schema depends on these types
- Precision in types = precision in event-sourcing architecture

## Technical Estimates

### Storage
- Raw response per event: ~50KB (25 MRs × 2KB each)
- 100 events: ~5MB
- 1000 events: ~50MB (unlimited retention)

### Performance
- Initial projection (100 events): ~50ms
- Incremental projection (1-5 new events): ~5-10ms
- Filtering projected MRs: <1ms (in-memory)

### Migration Complexity
- Can run parallel to old system
- Gradual cutover once validated
- Old cache preserved for rollback

## Success Metrics

- ❌ Before: Same MR fetched 3x across selections
- ✅ After: Each MR fetched once, stored once

- ❌ Before: 10 cache entries for 10 selections (~500KB duplicated data)
- ✅ After: 1 projection cache (~150KB unique data)

- ❌ Before: Selection switch = 1-2s fetch + 100ms delay
- ✅ After: Selection switch = <1ms filter update

- ❌ Before: No historical data
- ✅ After: Complete audit trail with time-travel

## Next Steps

Review and refine individual phase plans:
- `01-event-stream-storage.md`
- `02-response-normalization.md`
- `03-projection-engine.md`
- `04-multi-strategy-sync.md`
- `05-filtering-user-selections.md`
- `06-time-travel.md`
- `07-jira-integration.md`
- `08-migration-cleanup.md`
