# Change Tracking Projection System - Implementation Plan

## Overview

Create an event-sourcing projection system that detects new comments on merge requests by diffing consecutive events. The system will detect:
1. New comments/discussions on MRs

Changes will be console-logged for now (no UI integration yet).

**Note**: This is a focused MVP. Future iterations can add detection for new MRs, replies to my comments, and Jira status changes.

## Prerequisites

The `currentUser` field must be added to the Settings system - it's currently hardcoded as 'r.schoorstra' in `src/data/data-atom.ts` but should come from the settings file.

---

## Phase 0: Add currentUser to Settings

### Task 0.1: Update Settings Interface
**Files:** `src/settings/settings.ts`

Add `currentUser: string` to the `Settings` interface and `defaultSettings`:

```typescript
export interface Settings {
  // ... existing fields
  currentUser: string;
}

export const defaultSettings: Settings = {
  // ... existing fields
  currentUser: 'r.schoorstra'
};
```

### Task 0.2: Create currentUser Atom from Settings
**Files:** `src/settings/settings-atom.ts`

Add atom that reads from settings:

```typescript
export const currentUserAtom = Atom.make(get => {
  return Result.match(get(settingsAtom), {
    onInitial: () => 'r.schoorstra',
    onSuccess: ({ value }) => value.currentUser,
    onFailure: () => 'r.schoorstra'
  });
});
```

### Task 0.3: Remove Hardcoded currentUserAtom
**Files:** `src/data/data-atom.ts`, any files importing it

Remove line 6 from `data-atom.ts` and update all imports to use `currentUserAtom` from `settings-atom` instead.

---

## Phase 1: Change Tracking Infrastructure

### Task 1.1: Define Change Event Types
**Files:** `src/events/change-tracking-events.ts` (new)

Create schema for new comment change events using Effect Schema - just IDs:

```typescript
export type ChangeType = 'new-mr-comment'

const NewMrCommentChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-mr-comment'),
  mrId: Schema.String,
  noteId: Schema.String
})

export const ChangeEventSchema = NewMrCommentChangeSchema
export type ChangeEvent = Schema.Schema.Type<typeof ChangeEventSchema>
```

**Key principle**: Change events contain ONLY IDs. Display fields are looked up from existing read model projections.

### Task 1.2: Define Projection State Types
**Files:** `src/changetracking/change-tracking-state.ts` (new)

Define minimal state for tracking seen comment IDs:

```typescript
export interface ChangeTrackingState {
  // Map from mrId to Set of noteIds we've seen
  mrCommentIds: Map<string, Set<string>>
}

export const initialChangeTrackingState: ChangeTrackingState = {
  mrCommentIds: new Map()
}
```

**Key principle**: State contains ONLY the IDs needed to calculate diffs. No extra metadata.

---

## Phase 2: Comment Detection Projection

### Task 2.1: Define Diff Info Types
**Files:** `src/changetracking/mr-comments-projection.ts` (new)

Define types for the diff computation:

```typescript
import type { GitlabMergeRequest, DiscussionNote } from '../gitlab/gitlab-schema'
import type { ChangeTrackingState } from './change-tracking-state'
import type { ChangeEvent } from '../events/change-tracking-events'
import type { LazyReviewerEvent } from '../events/events'
import type {
  GitlabUserMergeRequestsFetchedEvent,
  GitlabprojectMergeRequestsFetchedEvent,
  GitlabSingleMrFetchedEvent
} from '../events/gitlab-events'
import {
  projectGitlabUserMrsFetchedEvent,
  projectGitlabProjectMrsFetchedEvent,
  projectGitlabSingleMrFetchedEvent
} from '../gitlab/gitlab-projections'

/**
 * Union of events that contain MR discussions
 */
type MrDiscussionsEvent =
  | GitlabUserMergeRequestsFetchedEvent
  | GitlabprojectMergeRequestsFetchedEvent
  | GitlabSingleMrFetchedEvent

/**
 * Represents an MR with all its discussions
 */
// flattened from discussions
type MrDiscussionsByMrId = Map<string, Set<string>>

/**
 * Diff information for a single MR - only what changed
 */
interface MrCommentDiff {
  mrId: string
  newNoteIds: Set<string>   // Only the IDs that are new (not in previous state)
}

/**
 * Result of the projection, containing detected changes and updated state
 */
interface CommentDetectionResult {
  changes: ChangeEvent[]                    // New comment change events to emit
  updatedCommentIds: Map<string, Set<string>>  // Updated mrId -> noteIds to merge into state
}
```

### Task 2.2: Implement Comments Detection Projection
**Files:** `src/changetracking/mr-comments-projection.ts` (new)

Main projection function with helper functions:

```typescript
/**
 * Type guard for events that contain MR discussions
 */
function isRelevantEvent(event: LazyReviewerEvent): event is MrDiscussionsEvent {
  return event.type === 'gitlab-user-mrs-fetched-event' ||
         event.type === 'gitlab-project-mrs-fetched-event' ||
         event.type === 'gitlab-single-mr-fetched-event'
}

/**
 * Extract ALL MRs with flattened notes from an event using existing projection functions
 */
function extractMrsWithNotes(
  event: MrDiscussionsEvent
): MrDiscussionsByMrId {
  let gitlabMrs: GitlabMergeRequest[] = []

  if (event.type === 'gitlab-user-mrs-fetched-event') {
    gitlabMrs = projectGitlabUserMrsFetchedEvent(event)
  } else if (event.type === 'gitlab-project-mrs-fetched-event') {
    gitlabMrs = projectGitlabProjectMrsFetchedEvent(event)
  } else if (event.type === 'gitlab-single-mr-fetched-event') {
    const mr = projectGitlabSingleMrFetchedEvent(event)
    gitlabMrs = mr ? [mr] : []
  }

  const result = new Map<string, Set<string>>()

  for (const mr of gitlabMrs) {
    const noteIds = new Set(mr.discussions.flatMap(d => d.notes).map(n => n.id))
    result.set(mr.id, noteIds)
  }

  return result
}

/**
 * Pure diff function: takes two Sets, returns elements in current not in previous
 */
function diffNoteIds(
  previous: Set<string>,
  current: Set<string>
): Set<string> {
  return new Set([...current].filter(id => !previous.has(id)))
}

/**
 * Compute diff for a single MR - takes two Sets of the same type, returns only what's new
 */
function computeMrDiff(
  currentNoteIds: Set<string>,
  previousNoteIds: Set<string> | undefined,
  mrId: string
): MrCommentDiff {
  const previous = previousNoteIds ?? new Set<string>()
  const newIds = diffNoteIds(previous, currentNoteIds)

  return {
    mrId,
    newNoteIds: newIds
  }
}

/**
 * Convert diff to change events - just IDs
 */
function diffToChangeEvents(
  diff: MrCommentDiff
): ChangeEvent[] {
  return [...diff.newNoteIds].map(noteId => ({
    changeType: 'new-mr-comment' as const,
    mrId: diff.mrId,
    noteId: noteId
  }))
}

/**
 * Main projection: detect new comments on ALL MRs
 */
export function detectNewMrComments(
  state: ChangeTrackingState,
  event: LazyReviewerEvent
): CommentDetectionResult {
  // Early return if not relevant event
  if (!isRelevantEvent(event)) {
    return { changes: [], updatedCommentIds: new Map() }
  }

  const mrDiscussionsByMrId = extractMrsWithNotes(event)

  const changes: ChangeEvent[] = []
  const updatedCommentIds = new Map<string, Set<string>>()

  for (const [mrId, currentCommentIds] of mrDiscussionsByMrId) {
    const previousCommentIds = state.mrCommentIds.get(mrId)
    const diff = computeMrDiff(currentCommentIds, previousCommentIds, mrId)

    // Only emit changes if there are new notes
    if (diff.newNoteIds.size > 0) {
      const newChanges = diffToChangeEvents(diff)
      changes.push(...newChanges)
    }

    // Always update state with current note IDs
    updatedCommentIds.set(mrId, currentCommentIds)
  }

  return { changes, updatedCommentIds }
}
```

---

## Phase 3: State Management

### Task 3.1: Create Change Tracking Projection Coordinator
**Files:** `src/changetracking/change-tracking-projection.ts` (new)

Main projection function that applies comment detection and updates state:

```typescript
import type { ChangeTrackingState } from './change-tracking-state'
import type { ChangeEvent } from '../events/change-tracking-events'
import type { LazyReviewerEvent } from '../events/events'
import { detectNewMrComments } from './mr-comments-projection'

interface ProjectionResult {
  changes: ChangeEvent[]
  newState: ChangeTrackingState
}

export function projectChangeTracking(
  state: ChangeTrackingState,
  event: LazyReviewerEvent
): ProjectionResult {
  const result = detectNewMrComments(state, event)

  // Merge updated comment IDs into state
  const newState: ChangeTrackingState = {
    mrCommentIds: new Map([
      ...state.mrCommentIds,
      ...result.updatedCommentIds
    ])
  }

  return {
    changes: result.changes,
    newState
  }
}
```

### Task 3.2: Create Change Tracking Atom
**Files:** `src/changetracking/change-tracking-atom.ts` (new)

Atom that:
1. Consumes `EventStorage.eventsStream`
2. Uses `Stream.scan` to apply `projectChangeTracking` to each event
3. Accumulates changes and maintains state
4. Logs changes to console as detected

```typescript
import { Atom } from '@effect-atom/atom-react'
import { Effect, Stream } from 'effect'
import { appAtomRuntime } from '../appLayerRuntime'
import { EventStorage } from '../events/events'
import { initialChangeTrackingState } from './change-tracking-state'
import { projectChangeTracking } from './change-tracking-projection'
import { formatChange } from './change-formatters'

export const changeTrackingAtom = appAtomRuntime.atom(
  (get) => {
    return Stream.unwrap(
      Effect.gen(function* () {
        const baseStream = yield* EventStorage.eventsStream

        return baseStream.pipe(
          Stream.scan(
            { state: initialChangeTrackingState, allChanges: [] },
            (acc, event) => {
              const result = projectChangeTracking(acc.state, event)

              if (result.changes.length > 0) {
                // Console log each change
                result.changes.forEach(change => {
                  console.log(formatChange(change, get))
                })
              }

              return {
                state: result.newState,
                allChanges: [...acc.allChanges, ...result.changes]
              }
            }
          )
        )
      })
    )
  },
  { initialValue: { state: initialChangeTrackingState, allChanges: [] } }
).pipe(Atom.keepAlive)
```

---

## Phase 4: Integration & Console Output

### Task 4.1: Add Console Logging Formatter
**Files:** `src/changetracking/change-formatters.ts` (new)

Helper function to format new comment changes - looks up data from `allMrsAtom`:

```typescript
import { Result } from '@effect-atom/atom-react'
import type { ChangeEvent } from '../events/change-tracking-events'
import type { Atom } from '@effect-atom/atom-react'
import { allMrsAtom } from '../mergerequests/mergerequests-atom'

export function formatChange(change: ChangeEvent, get: Atom.Get): string {
  // Look up MR from allMrsAtom read model using change.mrId
  const allMrsResult = get(allMrsAtom)
  const allMrsState = Result.match(allMrsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (state) => state.value
  })

  if (!allMrsState) {
    return `[NEW MR COMMENT] MR: ${change.mrId}, Note: ${change.noteId} (allMrs not loaded)`
  }

  const mr = allMrsState.mrsByGid.get(change.mrId)
  if (!mr) {
    return `[NEW MR COMMENT] MR: ${change.mrId}, Note: ${change.noteId} (MR not found)`
  }

  // Find note in MR discussions
  const note = mr.discussions
    .flatMap(d => d.notes)
    .find(n => n.id === change.noteId)

  if (!note) {
    return `[NEW MR COMMENT] !${mr.iid} - ${mr.title} - Note: ${change.noteId} (note not found)`
  }

  const preview = note.body.length > 100
    ? note.body.substring(0, 100) + '...'
    : note.body

  return `[NEW MR COMMENT] !${mr.iid} - ${mr.title} - ${note.author} commented: "${preview}"`
}
```

### Task 4.2: Update Change Tracking Atom with Formatted Logging
**Files:** `src/changetracking/change-tracking-atom.ts`

Already included in Task 3.2 - the atom imports and uses `formatChange` from `./change-formatters`.

### Task 4.3: Initialize Change Tracking in App
**Files:** Main app file (App.tsx or similar)

Import and activate `changeTrackingAtom`:

```typescript
import { changeTrackingAtom } from "./changetracking/change-tracking-atom"

useEffect(() => {
  const subscription = changeTrackingAtom.subscribe(() => {})
  return () => subscription.unsubscribe()
}, [])
```

### Task 4.4: Testing and Validation

Test scenarios:
1. Fetch MRs with discussions
2. Add comments via GitLab to any MR
3. Re-fetch MRs - verify comment detection in console
4. Verify changes only detected once (not on subsequent fetches with same data)
5. Verify ALL new comments are detected (on any MR, not filtered by author)

---

## Implementation Order

1. **Phase 0** (all tasks) - Prerequisites for user identification
2. **Phase 1** (all tasks) - Foundation types and state
3. **Phase 2** (sequential):
   - Task 2.1 (Define diff info types)
   - Task 2.2 (Implement projection)
4. **Phase 3** (sequential):
   - Task 3.1 (Projection coordinator)
   - Task 3.2 (Atom)
5. **Phase 4** (sequential):
   - Task 4.1 (Formatter)
   - Task 4.2 (Update atom)
   - Task 4.3 (Initialize)
   - Task 4.4 (Test)

---

## Key Design Decisions

1. **Minimal state**: State contains ONLY the IDs needed for diff computation - `Map<mrId, Set<noteId>>`. No extra metadata.
2. **Minimal change events**: Change events contain ONLY IDs (`mrId`, `noteId`). All display data is looked up from `allMrsAtom` read model when needed for formatting.
3. **Record only what changed**: Diff types (`MrCommentDiff`) contain only `mrId` and `newNoteIds` - we don't track "previous" state in the diff, just what's new.
4. **Separation of diff and display**: No display fields in state, diff types, or change events. Display formatting uses existing read model projections.
5. **Pure diff function**: The core `diffNoteIds(previous: Set<string>, current: Set<string>): Set<string>` function takes two parameters of the same type and returns the difference.
6. **Event-to-event diffing**: Maintains note IDs in state and diffs new events against previous snapshots using Set-based comparison
7. **Uses existing projections**: Leverages existing projection functions (`projectGitlabUserMrsFetchedEvent`, etc.) and types (`GitlabMergeRequest`, `DiscussionNote`) from the codebase
8. **Focused MVP scope**: Starting with only "new comments on MRs" to validate the approach before expanding to other change types
9. **No filtering by author**: Detect new comments on ALL MRs, not filtered to specific authors
10. **Stateful stream scanning**: Use Effect `Stream.scan` to maintain state across events from `EventStorage.eventsStream`
11. **Console output only**: No UI integration yet - just formatted console logs using `allMrsAtom` for display data
12. **No change event persistence**: Changes are ephemeral notifications, not stored as events
13. **Future extensibility**: The projection structure allows easy addition of new change types (new MRs, replies to my comments, Jira changes) later

---

## Critical Files

- `src/settings/settings.ts` - Add currentUser field
- `src/settings/settings-atom.ts` - Export currentUserAtom from settings
- `src/events/change-tracking-events.ts` - Change event type definition (NewMrCommentChange)
- `src/changetracking/change-tracking-state.ts` - Minimal state type (Map<mrId, Set<noteId>>)
- `src/changetracking/mr-comments-projection.ts` - Diff info types and comment detection logic
- `src/changetracking/change-tracking-projection.ts` - Projection coordinator
- `src/changetracking/change-tracking-atom.ts` - Event stream consumption with Stream.scan
- `src/changetracking/change-formatters.ts` - Console log formatting
