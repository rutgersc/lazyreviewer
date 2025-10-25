# Migration Plan: Effect-Based Caching with Schemas

**Date**: 2025-10-25
**Status**: Planning
**Author**: Claude Code

## Brief Summary

Migrate LazyGitLab from manual file-based caching (using `superjson` and `diskCache.ts`) to Effect-TS native caching using `@effect/schema` for automatic serialization and `KeyValueStore.layerFileSystem` for persistence.

**User Intent**: Replace manual cache file writing/reading with Effect-atom's built-in caching that persists to filesystem, eliminating the need for superjson and manual cache management.

---

## Overview

### Current State

- Manual caching using `saveCache()` / `loadCache()` in `src/system/diskCache.ts`
- Uses `superjson` for serialization (handles Date objects, etc.)
- Cache keys manually generated in `mergerequests-effects.ts`
- Cache files stored in `debug/` directory
- No automatic deduplication or TTL management

### Target State

- Automatic caching using Effect-atom's `Atom.family()` pattern
- Effect Schemas (`@effect/schema`) for type-safe serialization
- Native `KeyValueStore.layerFileSystem` for filesystem persistence
- Automatic deduplication (same parameters = same cached atom)
- Built-in TTL with `Atom.setIdleTTL()`
- No manual `saveCache()`/`loadCache()` calls

---

## Goals

✅ **Remove superjson dependency**: Use Effect's built-in schema serialization
✅ **Type-safe caching**: Compile-time and runtime type safety with schemas
✅ **Automatic serialization**: Effect handles Date and complex type serialization
✅ **Cleaner code**: Remove manual `saveCache()`/`loadCache()` calls
✅ **Better caching**: Automatic deduplication and TTL management with `Atom.family()`
✅ **Maintain file structure**: Continue using `debug/` directory for cache files

---

## Technical Architecture

### Key Components

1. **Effect Schemas** (`@effect/schema`)
   - Define type-safe schemas for all cached data
   - Automatic Date serialization with `Schema.Date`
   - Validation on encode/decode

2. **KeyValueStore** (`@effect/platform`)
   - Native filesystem layer: `KeyValueStore.layerFileSystem("debug")`
   - Schema-aware store: `store.forSchema(schema)`
   - Automatic JSON encoding/decoding

3. **Atom.family()** (`@effect-atom/atom`)
   - Parameterized atom factory
   - Automatic deduplication via structural equality
   - Same parameters = same cached atom instance

4. **Data.Class** (`effect`)
   - Cache key classes with structural equality
   - Hash-based lookup for O(1) cache hits

### Data Flow

```
User Action (fetch MRs)
    ↓
Create cache key (MRCacheKey)
    ↓
Atom.family(key) → Check if atom exists
    ↓
Atom.make(Effect) → fetchWithCache Effect
    ↓
KeyValueStore.get(cacheKey) → Try filesystem
    ↓
Cache Hit? → Return cached data (decode via schema)
    ↓
Cache Miss? → Fetch from API
    ↓
KeyValueStore.set(cacheKey, data) → Save (encode via schema)
    ↓
Return fresh data
```

---

## Phases and Tasks

### Phase 1: Setup and Dependencies
**Objective**: Install required Effect packages

#### Task 1.1: Install Effect platform dependencies
- **Command**: `bun add @effect/platform @effect/platform-node @effect/schema`
- **Dependencies**: None
- **Verification**: Check `package.json` includes new dependencies

---

### Phase 2: Define Type Schemas
**Objective**: Create Effect schemas for all data types currently using superjson

#### Task 2.1: Create schema file
- **File**: `src/schemas/mergeRequestSchema.ts`
- **Dependencies**: Task 1.1 (needs @effect/schema installed)
- **Verification**: File exists and imports work

#### Task 2.2: Define nested schemas
- **Schemas**: `PipelineJobSchema`, `PipelineStageSchema`, `DiscussionNoteSchema`, `DiscussionSchema`
- **Dependencies**: Task 2.1
- **Key Points**:
  - Use `Schema.String`, `Schema.Number`, `Schema.Boolean` primitives
  - Use `Schema.NullOr()` for nullable fields
  - Use `Schema.Array()` for array fields
  - Use `Schema.Struct()` for objects

#### Task 2.3: Define GitlabMergeRequest schema
- **Schema**: `GitlabMergeRequestSchema`
- **Dependencies**: Task 2.2 (needs nested schemas)
- **Key Points**:
  - Use `Schema.Date` for `createdAt`, `updatedAt` (automatic serialization!)
  - Match structure from `src/gitlab/gitlabgraphql.ts:60-93`
  - Include all fields from interface

#### Task 2.4: Define Jira and MergeRequest schemas
- **Schemas**: `JiraIssueSchema`, `MergeRequestSchema`
- **Dependencies**: Task 2.3
- **Key Points**:
  - `JiraIssueSchema` needs `fields.summary`, `fields.status.name`
  - `MergeRequestSchema` extends GitlabMergeRequest with `jiraIssues` array

#### Task 2.5: Export inferred types
- **Exports**:
  ```typescript
  export type GitlabMergeRequest = Schema.Schema.Type<typeof GitlabMergeRequestSchema>
  export type JiraIssue = Schema.Schema.Type<typeof JiraIssueSchema>
  export type MergeRequest = Schema.Schema.Type<typeof MergeRequestSchema>
  ```
- **Dependencies**: Tasks 2.3, 2.4
- **Verification**: Types inferred correctly, no `any` types

**Files Created**: `src/schemas/mergeRequestSchema.ts`

---

### Phase 3: Create Caching Infrastructure
**Objective**: Build Effect-based caching utilities

#### Task 3.1: Create cachedAtom factory
- **File**: `src/cache/cachedAtom.ts`
- **Dependencies**: Phase 2 complete (needs schemas)
- **Implementation**:
  ```typescript
  export function cachedAtom<A, I, R>(
    cacheKey: string,
    schema: Schema.Schema<A, I, R>,
    fetch: Effect.Effect<A, any, never>,
    ttl: Duration.DurationInput = Duration.seconds(60)
  )
  ```
- **Key Points**:
  - Uses `KeyValueStore.layerFileSystem("debug")`
  - Uses `store.forSchema(schema)` for auto serialization
  - Implements cache-hit/miss logic with `Effect.option()`
  - Applies TTL with `Atom.setIdleTTL()`
- **Verification**: TypeScript compiles, no type errors

#### Task 3.2: Create MR cache atom families
- **File**: `src/store/mrCacheAtoms.ts`
- **Dependencies**: Task 3.1 (needs `cachedAtom` function)
- **Implementation**:
  - Define `MRCacheKey` class (extends `Data.Class`)
  - Define `ProjectMRCacheKey` class (extends `Data.Class`)
  - Implement `toCacheKey()` methods (filesystem-safe names)
  - Create `mrsByUserAtomFamily` using `Atom.family()` + `cachedAtom()`
  - Create `mrsByProjectAtomFamily` using `Atom.family()` + `cachedAtom()`
- **Key Points**:
  - Cache keys sanitize special characters (`:`, `/`, ` `)
  - Use `Schema.Array(MergeRequestSchema)` as schema
  - Set TTL to 60 seconds
  - Export cache key classes for use in appAtoms
- **Verification**: Families return atoms with correct types

**Files Created**:
- `src/cache/cachedAtom.ts`
- `src/store/mrCacheAtoms.ts`

---

### Phase 4: Integration
**Objective**: Wire up new caching in existing application code

#### Task 4.1: Update appAtoms.ts
- **File**: `src/store/appAtoms.ts`
- **Dependencies**: Phase 3 complete
- **Changes**:
  - Import `mrsByUserAtomFamily`, `mrsByProjectAtomFamily`, `MRCacheKey`, `ProjectMRCacheKey`
  - Modify `mergeRequestsAtom` (lines 48-73):
    - Create `MRCacheKey` or `ProjectMRCacheKey` based on selection
    - Use `get(atomFamily(cacheKey))` instead of `Effect.tryPromise(fetch...)`
  - Remove direct `fetchMergeRequests()` / `fetchMergeRequestsByProject()` calls
- **Verification**: `mergeRequestsAtom` now returns cached data

#### Task 4.2: Update type exports in gitlabgraphql.ts
- **File**: `src/gitlab/gitlabgraphql.ts`
- **Dependencies**: Task 2.5 (schema types exported)
- **Changes**:
  - Remove `export interface GitlabMergeRequest` (lines 60-93)
  - Add `export type { GitlabMergeRequest } from "../schemas/mergeRequestSchema"`
- **Verification**: No type errors, re-export works

#### Task 4.3: Update type exports in MergeRequestPane.tsx
- **File**: `src/components/MergeRequestPane.tsx`
- **Dependencies**: Task 2.5
- **Changes**:
  - Remove local `MergeRequest` type definition
  - Add `export type { MergeRequest } from "../schemas/mergeRequestSchema"`
- **Verification**: Component still type-checks

#### Task 4.4: Update type imports across codebase
- **Files**:
  - `src/components/ActivityLog.tsx`
  - `src/hooks/useBranchDifferences.ts`
  - `src/mergerequests/branch-difference-effects.ts`
  - `src/mergerequests/mergerequests-effects.ts`
  - `src/gitlab/gitlabDiscussionFormatter.ts`
  - `src/components/EventLogPane.tsx`
  - `src/hooks/useRepositoryBranches.ts`
  - `src/jira/jiraService.ts` (if imports `JiraIssue`)
- **Dependencies**: Tasks 4.2, 4.3
- **Changes**:
  - Update imports to use schema-exported types
  - Verify no local type definitions conflict
- **Verification**: `bun run typecheck` passes

**Files Modified**:
- `src/store/appAtoms.ts`
- `src/gitlab/gitlabgraphql.ts`
- `src/components/MergeRequestPane.tsx`
- `src/components/ActivityLog.tsx`
- `src/hooks/useBranchDifferences.ts`
- `src/mergerequests/branch-difference-effects.ts`
- `src/mergerequests/mergerequests-effects.ts`
- `src/gitlab/gitlabDiscussionFormatter.ts`
- `src/components/EventLogPane.tsx`
- `src/hooks/useRepositoryBranches.ts`

---

### Phase 5: Cleanup
**Objective**: Remove obsolete manual caching code

#### Task 5.1: Remove manual cache calls from mergerequests-effects.ts
- **File**: `src/mergerequests/mergerequests-effects.ts`
- **Dependencies**: Phase 4 complete (new caching working)
- **Changes**:
  - Remove all `saveCache()` calls (lines 56, 57, 86, 87, 212)
  - Remove all `loadCache()` calls (lines 100, 101, 114, 124, 150, 202)
  - Remove import: `import { loadCache, saveCache } from "../system/diskCache"`
- **Verification**: No references to `diskCache` remain

#### Task 5.2: Delete obsolete functions
- **File**: `src/mergerequests/mergerequests-effects.ts`
- **Dependencies**: Task 5.1
- **Changes**:
  - Delete `getCachedMergeRequests()` function (lines 106-130)
  - Delete `loadMergeRequests()` function (lines 92-104)
- **Verification**: No other files import these functions

#### Task 5.3: Delete diskCache.ts
- **File**: `src/system/diskCache.ts`
- **Dependencies**: Task 5.1 (no more references)
- **Verification**: `bun run typecheck` passes, no import errors

#### Task 5.4: Remove superjson dependency
- **File**: `package.json`
- **Dependencies**: Task 5.3
- **Command**: `bun remove superjson`
- **Verification**: `superjson` not in dependencies

#### Task 5.5: Run typecheck
- **Command**: `bun run typecheck`
- **Dependencies**: Tasks 5.1-5.4
- **Verification**: No type errors

#### Task 5.6: Test application
- **Dependencies**: Task 5.5
- **Tests**:
  - Load application
  - Fetch MRs (should see `[Cache] Miss` in console)
  - Reload/re-fetch (should see `[Cache] Hit`)
  - Verify files exist in `debug/*.json`
  - Verify dates are correct (not strings)
  - Switch user selections (verify different cache keys)
  - Wait 60+ seconds, verify TTL expiration

**Files Deleted**:
- `src/system/diskCache.ts`

**Files Modified**:
- `src/mergerequests/mergerequests-effects.ts`
- `package.json`

---

## Task Dependencies Graph

```
Phase 1: Install deps (1.1)
         ↓
Phase 2: Define schemas
         2.1 (create file)
         ↓
         2.2 (nested schemas) ← depends on 2.1
         ↓
         2.3 (GitlabMR schema) ← depends on 2.2
         ↓
         2.4 (Jira/MR schemas) ← depends on 2.3
         ↓
         2.5 (export types) ← depends on 2.3, 2.4
         ↓
Phase 3: Create caching infrastructure
         3.1 (cachedAtom factory) ← depends on Phase 2
         ↓
         3.2 (MR cache atoms) ← depends on 3.1
         ↓
Phase 4: Integration
         4.1 (update appAtoms) ← depends on 3.2
         ↓
         4.2 (update gitlabgraphql) ← depends on 2.5
         ↓
         4.3 (update MRPane) ← depends on 2.5
         ↓
         4.4 (update imports) ← depends on 4.2, 4.3
         ↓
Phase 5: Cleanup
         5.1 (remove cache calls) ← depends on Phase 4
         ↓
         5.2 (delete functions) ← depends on 5.1
         ↓
         5.3 (delete diskCache) ← depends on 5.1
         ↓
         5.4 (remove superjson) ← depends on 5.3
         ↓
         5.5 (typecheck) ← depends on 5.1-5.4
         ↓
         5.6 (test app) ← depends on 5.5
```

---

## Testing Strategy

### After Phase 1
- **Check**: `package.json` has new dependencies
- **Command**: `bun install` completes successfully

### After Phase 2
- **Check**: Schemas defined correctly
- **Command**: `bun run typecheck` (schemas should compile)
- **Verify**: No `any` types in exported types

### After Phase 3
- **Check**: Cache infrastructure compiles
- **Command**: `bun run typecheck`
- **Verify**: `cachedAtom` function signature correct

### After Phase 4
- **Check**: Integration works end-to-end
- **Command**: `bun run typecheck`
- **Manual Test**:
  - Run app
  - Check console for `[Cache] Miss` on first load
  - Check console for `[Cache] Hit` on reload
  - Verify `debug/*.json` files created
  - Verify dates in JSON are ISO strings
  - Verify dates in app are Date objects

### After Phase 5
- **Check**: All cleanup complete
- **Command**: `bun run typecheck`
- **Verify**: No references to `diskCache` or `superjson`
- **Full Test**:
  - Fetch MRs by user selection
  - Fetch MRs by project selection
  - Switch between selections (different cache keys)
  - Wait 60+ seconds idle, verify refetch
  - Check cache file contents (readable JSON)

---

## Rollback Plan

### If Issues in Phase 4 (Integration)
- Keep old caching code in `mergerequests-effects.ts`
- Don't delete `diskCache.ts` yet
- Can run both systems in parallel for testing

### If Issues in Phase 5 (Cleanup)
- Restore `src/system/diskCache.ts` from git
- Re-add `superjson` dependency: `bun add superjson`
- Restore `saveCache()`/`loadCache()` calls

### If Schema Issues
- Fall back to "Option 1" (superjson wrapper approach)
- Use `superjson.parse()`/`superjson.stringify()` inside KeyValueStore layer
- Skip schema definitions, keep existing types

---

## Success Criteria

✅ **No superjson dependency** in `package.json`
✅ **No diskCache.ts file** exists
✅ **No manual saveCache()/loadCache()** calls in codebase
✅ **bun run typecheck passes** with no errors
✅ **Application loads and caches MRs** correctly
✅ **Cache files in debug/ directory** are readable JSON
✅ **Dates serialize/deserialize** correctly (no string/Date confusion)
✅ **Cache hit/miss logs** appear in console
✅ **TTL expiration works** after 60 seconds idle
✅ **Different selections** create different cache files
✅ **Console shows** `[Cache] Hit:` and `[Cache] Miss:` messages

---

## Notes and Considerations

### Effect Schema Serialization
- `Schema.Date` automatically encodes Date → ISO string (JSON)
- Decodes ISO string → Date object (type-safe!)
- No need for `superjson`'s custom serialization

### Cache Key Generation
- Use `Data.Class` for structural equality
- Sanitize special characters for filesystem safety
- Example: `mrs_opened_Project_Foo_gitlab.json`

### Backward Compatibility
- New cache files replace old ones gradually
- Old cache files from `superjson` can be deleted manually
- No migration script needed (cache is transient data)

### Performance
- In-memory atom cache (fast)
- Filesystem read only on cache miss
- Deduplication prevents duplicate API calls

### Error Handling
- Schema decode errors logged (validation failures)
- Cache corruption → falls back to fetch
- Network errors → Effect error channel

---

## Related Documentation

- Effect Schema: https://effect.website/docs/schema/introduction
- Effect Platform: https://effect.website/docs/platform/introduction
- effect-atom: F:\GitRepos\effect-atom\packages\atom\README.md
- KeyValueStore: F:\GitRepos\effect-atom\packages\atom\src\Atom.ts (kvs examples)

---

**Status**: Ready for implementation
**Next Step**: Execute Phase 1 (Install dependencies)
