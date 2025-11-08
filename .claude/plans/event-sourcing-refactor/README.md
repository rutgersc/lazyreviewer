# Event-Sourcing Refactor - Implementation Plan

This directory contains the detailed implementation plan for refactoring LazyGitLab from a user-centric caching architecture to an event-sourced system with projection-based state management.

## Quick Navigation

### 📋 Start Here
- **[00-overview.md](./00-overview.md)** - Problem statement, solution overview, and design decisions

### 🔨 Implementation Phases (CORRECT ORDER)

**⚠️ IMPORTANT: Phases must be done in order due to dependencies!**

1. **[01-raw-fetch-methods.md](./01-raw-fetch-methods.md)** ⭐ **START HERE**
   - Create raw fetch functions (return unprocessed API responses)
   - Define TypeScript types for all API responses
   - Union type for all raw responses
   - Type guards for response discrimination
   - **Dependencies:** None (foundational)

2. **[02-event-stream-storage.md](./02-event-stream-storage.md)**
   - Append-only event log
   - Auto-incrementing event IDs
   - Event storage service using response types from Phase 1
   - **Dependencies:** Phase 1 (needs raw response types)

3. **[03-response-normalization.md](./03-response-normalization.md)**
   - Parser interface for raw API responses
   - MR unique identifier (MRId)
   - GitLab & Bitbucket parsers
   - **Dependencies:** Phase 1 (needs raw response types), Phase 2 (stores events)

4. **[04-projection-engine.md](./04-projection-engine.md)**
   - Project events into current MR state
   - Incremental projection cache
   - Last-write-wins conflict resolution
   - **Dependencies:** Phase 2 (event storage), Phase 3 (parsers)

5. **[05-multi-strategy-sync.md](./05-multi-strategy-sync.md)**
   - Repository sync (all MRs in repo)
   - User sync (all MRs by author)
   - Single MR refresh
   - Sync orchestration
   - **Dependencies:** Phase 1 (raw fetches), Phase 2 (event append), Phase 4 (projection)

6. **[06-filtering-user-selections.md](./06-filtering-user-selections.md)**
   - User selections as client-side filters
   - Filter predicate builder
   - Instant selection switching
   - **Dependencies:** Phase 4 (projected MRs), Phase 5 (sync)

7. **[07-time-travel.md](./07-time-travel.md)**
   - View MR state at any event
   - Event history browser UI
   - Historical comparison
   - **Dependencies:** Phase 4 (projection), Phase 6 (filtering)

8. **[08-jira-integration.md](./08-jira-integration.md)**
   - Fetch Jira for projected MRs
   - Jira deduplication
   - Optional: Jira events
   - **Dependencies:** Phase 4 (projected MRs), Phase 6 (filtering)

9. **[09-migration-cleanup.md](./09-migration-cleanup.md)**
   - Migrate old cache to events
   - Remove legacy code
   - Clean old storage
   - Update documentation
   - **Dependencies:** All phases complete

## Current Status

- [x] Architecture research complete
- [x] Design decisions made
- [x] Fetch methods analysis complete (FETCH_METHODS_ANALYSIS.md)
- [x] Implementation plan created and **reordered correctly**
- [x] **Phase 1 complete** ✅ (Raw Fetch Methods - all fetch functions exist)
- [ ] **Phase 2 ready to start** ⭐ (Event Storage - simplified file-based approach)
- [ ] Phase 3 not started (Response Normalization)
- [ ] Phase 4 not started (Projection Engine)
- [ ] Phase 5 not started (Multi-Strategy Sync)
- [ ] Phase 6 not started (Filtering)
- [ ] Phase 7 not started (Time-Travel)
- [ ] Phase 8 not started (Jira Integration)
- [ ] Phase 9 not started (Migration & Cleanup)

## ⚠️ Important Notes

### Why Phase Order Matters

**Phase 1 MUST come before Phase 2** because:
1. Event storage needs to know the structure of API responses
2. TypeScript types from raw responses are used in event definitions
3. We want precise types, not `unknown`
4. Type safety across the entire system depends on this foundation

### Previous Mistake

We initially tried to build event storage (old Phase 1) before knowing what we'd store. This was backward. The correct order is:

```
Fetch → Types → Storage → Parse → Project
```

Not:
```
Storage → Fetch → Parse → Project  ❌
```

## Key Concepts

### Event Sourcing
- All data changes stored as immutable events
- Current state = projection of event history
- Complete audit trail with time-travel capability

### Projection
- Derived state calculated from events
- Last-write-wins based on timestamp
- Incremental updates for performance

### Normalized Storage
- Per-MR storage (Map<MRId, MR>)
- No duplication across user selections
- Single source of truth

### Client-Side Filtering
- User selections filter projected MRs
- No fetching on selection switch
- Instant UI updates (<1ms)

## Benefits Summary

### Performance
- ✅ No duplicate MR fetching/storage
- ✅ Instant selection switching
- ✅ Reduced Jira API calls
- ✅ Incremental projection updates

### Features
- ✅ Time-travel (view historical state)
- ✅ Complete repo visibility
- ✅ Flexible sync strategies
- ✅ Audit trail for debugging

### Architecture
- ✅ Single source of truth
- ✅ Immutable data
- ✅ Testable (replay events)
- ✅ Future-proof

## Implementation Strategy

### Phase-by-Phase Approach
1. Build event storage alongside old cache (parallel)
2. Implement projection and verify correctness
3. Switch UI to use projected state
4. Migrate old data to events
5. Remove legacy code

### Testing at Each Phase
- Unit tests for new functionality
- Integration tests with old system
- Performance benchmarks
- UI validation

### Rollback Safety
- Keep old cache during migration
- Feature flag for gradual cutover
- Can revert if issues found

## Getting Started

1. **Read the overview**: Start with `00-overview.md` to understand the problem and solution
2. **Review Phase 1**: Read `01-event-stream-storage.md` for the first implementation phase
3. **Ask questions**: Clarify any uncertainties before coding
4. **Implement incrementally**: Complete one phase before moving to next
5. **Test thoroughly**: Verify each phase works before proceeding

## Questions & Refinements

Use this plan as a living document:
- ✏️ Refine details as implementation progresses
- 🐛 Document issues and solutions
- 💡 Add insights and learnings
- 📝 Update status as phases complete

## Related Files

### Existing Architecture (to be replaced)
- `src/mergerequests/mergerequests-effects.ts` - Current fetch logic
- `src/mergerequests/mergerequests-caching-effects.ts` - Cache management
- `src/store/appAtoms.ts` - MR state atoms

### New Architecture (to be created)
- `src/events/` - Event storage, projection, parsers
- `src/sync/` - Sync strategies (repo/user/single-MR)
- `src/filtering/` - Filter predicates
- `src/migration/` - Data migration scripts

---

**Last Updated:** 2025-11-06
**Status:** Plan complete, ready for implementation
