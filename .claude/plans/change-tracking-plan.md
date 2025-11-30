# Change Tracking Projection System - Implementation Plan

## Overview

Create an event-sourcing projection system that tracks important changes across merge requests and Jira issues by diffing consecutive events. The system will detect:
1. New MRs
2. New comments/discussions on MY MRs (where I'm the author)
3. New replies to MY comments on any MR
4. Jira status changes for MRs

Changes will be console-logged for now (no UI integration yet).

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

Create schemas for change events using Effect Schema:

```typescript
export type ChangeType =
  | 'new-mr'
  | 'new-comment-on-my-mr'
  | 'new-reply-to-my-comment'
  | 'jira-status-change'

// Individual schemas
const NewMrChangeSchema = Schema.Struct({
  changeType: Schema.Literal('new-mr'),
  mrId: Schema.String,
  mrIid: Schema.String,
  mrTitle: Schema.String,
  author: Schema.String,
  projectPath: Schema.String,
  detectedAt: Schema.Date
})

// ... similar for other change types

export const ChangeEventSchema = Schema.Union(
  NewMrChangeSchema,
  NewCommentOnMyMrChangeSchema,
  NewReplyToMyCommentChangeSchema,
  JiraStatusChangeSchema
)
```

### Task 1.2: Define Projection State Types
**Files:** `src/changetracking/change-tracking-state.ts` (new)

Define types for tracking last seen state:

```typescript
export interface MrDiscussionSnapshot {
  mrId: string
  mrIid: string
  author: string
  discussions: Discussion[]
  timestamp: Date
}

export interface JiraSnapshot {
  jiraKey: string
  status: string
  summary: string
  updated: string
  timestamp: Date
}

export interface ChangeTrackingState {
  mrSnapshots: Map<string, MrDiscussionSnapshot>
  jiraSnapshots: Map<string, JiraSnapshot>
}
```

---

## Phase 2: Individual Change Projections

### Task 2.1: New MR Projection
**Files:** `src/changetracking/new-mr-projection.ts` (new)

Filter and projection functions:
- `isNewMrRelevantEvent()` - type guard for MR events
- `detectNewMrs(state, event, currentUser)` - detect MRs not in snapshots

Logic:
1. Extract MRs from event using existing projection functions
2. Compare against `state.mrSnapshots`
3. Emit `NewMrChange` for MRs not in map
4. Update snapshots with all MRs from event

### Task 2.2: New Comments on MY MRs Projection
**Files:** `src/changetracking/my-mr-comments-projection.ts` (new)

Projection function: `detectNewCommentsOnMyMrs(state, event, currentUser)`

Logic:
1. Filter to MRs where `mr.author === currentUser`
2. Build set of previously seen note IDs from snapshot
3. Find notes in current event not in previous set
4. Emit `NewCommentOnMyMrChange` for each new note
5. Update snapshots

### Task 2.3: New Replies to MY Comments Projection
**Files:** `src/changetracking/my-comment-replies-projection.ts` (new)

Projection function: `detectNewRepliesToMyComments(state, event, currentUser)`

Logic:
1. For each MR, find discussions where I have a comment
2. Build set of previously seen note IDs
3. Find new notes in those discussions where `note.author !== currentUser`
4. Emit `NewReplyToMyCommentChange`
5. Update snapshots

### Task 2.4: Jira Status Change Projection
**Files:** `src/changetracking/jira-status-projection.ts` (new)

Filter and projection:
- `isJiraRelevantEvent()` - type guard for jira-issues-fetched-event
- `detectJiraStatusChanges(state, event)` - compare status against snapshot

Logic:
1. Extract Jira issues from event
2. Compare `issue.fields.status.name` against snapshot
3. If different, emit `JiraStatusChange`
4. Update snapshots

---

## Phase 3: State Management

### Task 3.1: Create Unified Change Tracking Projection
**Files:** `src/changetracking/change-tracking-projection.ts` (new)

Main projection function: `projectChangeTracking(state, event, currentUser)`

Logic:
1. Route events to appropriate detectors
2. Apply detectors sequentially (each updates state)
3. Aggregate all changes
4. Return `{ changes, newState }`

### Task 3.2: Create Change Tracking Atom
**Files:** `src/changetracking/change-tracking-atom.ts` (new)

Atom that:
1. Consumes `EventStorage.eventsStream`
2. Uses `Stream.scan` to apply `projectChangeTracking` to each event
3. Depends on `currentUserAtom` for current user
4. Accumulates changes and maintains state
5. Logs changes to console as detected

```typescript
export const changeTrackingAtom = appAtomRuntime.atom(
  (get) => {
    const currentUser = get(currentUserAtom)

    return Stream.unwrap(
      Effect.gen(function* () {
        const baseStream = yield* EventStorage.eventsStream

        return baseStream.pipe(
          Stream.scan(
            { state: initialChangeTrackingState, allChanges: [] },
            (acc, event) => {
              const result = projectChangeTracking(acc.state, event, currentUser)

              if (result.changes.length > 0) {
                // Console log here
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

### Task 4.1: Add Console Logging Formatters
**Files:** `src/changetracking/change-formatters.ts` (new)

Helper functions to format each change type:
- `formatNewMr(change)` - "[NEW MR] !123 - 'Title' by author in project"
- `formatNewCommentOnMyMr(change)` - "[NEW COMMENT ON MY MR] !123 - user commented: '...'"
- `formatNewReplyToMyComment(change)` - "[REPLY TO MY COMMENT] !123 - user replied: '...'"
- `formatJiraStatusChange(change)` - "[JIRA STATUS] ELAB-123 - 'Summary' changed from 'X' to 'Y'"
- `formatChange(change)` - switch on changeType

### Task 4.2: Update Change Tracking Atom with Formatted Logging
**Files:** `src/changetracking/change-tracking-atom.ts`

Import and use formatters in the Stream.scan logging section.

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
1. Fetch MRs - verify new MR detection
2. Add comments via GitLab - verify comment detection
3. Update Jira status - verify Jira change detection
4. Verify changes only detected once
5. Verify currentUser filtering works

---

## Implementation Order

1. **Phase 0** (all tasks) - Prerequisites for user identification
2. **Phase 1** (all tasks) - Foundation types and state
3. **Phase 2** - Implement projections (can be done in parallel):
   - Task 2.1 (New MR) - foundational, others depend on this
   - Tasks 2.2, 2.3, 2.4 (other projections)
4. **Phase 3** (sequential):
   - Task 3.1 (Unified projection)
   - Task 3.2 (Atom)
5. **Phase 4** (sequential):
   - Task 4.1 (Formatters)
   - Task 4.2 (Update atom)
   - Task 4.3 (Initialize)
   - Task 4.4 (Test)

---

## Key Design Decisions

1. **Event-to-event diffing**: Each projection maintains snapshots of entities (MRs, Jira issues) and diffs new events against previous snapshots
2. **Separate projection files**: Each change type has its own file following existing patterns
3. **Unified coordinator**: `change-tracking-projection.ts` orchestrates all detectors
4. **Stateful stream scanning**: Use Effect Stream.scan to maintain state across events
5. **Console output only**: No UI integration yet - just formatted console logs
6. **No change event persistence**: Changes are ephemeral notifications, not stored as events

---

## Critical Files

- `src/settings/settings.ts` - Add currentUser field
- `src/changetracking/change-tracking-projection.ts` - Core coordination logic
- `src/changetracking/my-mr-comments-projection.ts` - Example discussion diffing
- `src/changetracking/change-tracking-atom.ts` - Event stream consumption
- `src/events/change-tracking-events.ts` - Change event type definitions
