# Phase 2: Event Stream Storage (File I/O)

## Goal
Simple file-based storage for events. Two functions: `loadEvents()` and `appendEvent()`.

## Dependencies
- **Phase 1 complete** ✅ (fetch functions and event types exist)
- Uses existing event types from `src/events/events.ts`

## Design: Numbered Event Files

### File Naming Pattern
```
events/
  0_2025-11-08T10-30-00-000Z_gitlab-user-mrs-fetched-event.json
  1_2025-11-08T10-35-12-456Z_gitlab-project-mrs-fetched-event.json
  2_2025-11-08T10-40-25-789Z_bitbucket-prs-fetched-event.json
  3_2025-11-08T11-15-00-123Z_gitlab-single-mr-fetched-event.json
  ...
```

**Format:** `{sequentialNumber}_{timestamp}_{event.type}.json`

- Sequential numbering: 0, 1, 2, 3, ...
- Timestamp: ISO 8601 with colons replaced by hyphens (filesystem-safe)
- Event type comes from the event's `type` field
- No concurrency handling (single-process app)

## Implementation

### Task 2.1: loadEvents()

**Load all events from disk, sorted by number:**

```typescript
// src/events/eventStorage.ts

import type { Event } from './events';

/**
 * Load all events from disk, sorted by event number
 * Parses event number and timestamp from filename
 */
export const loadEvents = (): Effect<Event[]>
```

**Implementation:**
1. Read `events/` directory
2. Parse filenames to extract numbers and timestamps
3. Sort by number (ascending)
4. Read each JSON file
5. Parse as `Event` type
6. Return sorted array

**Example result:**
```typescript
[
  { type: 'gitlab-user-mrs-fetched-event', mrs: {...}, forUsernames: [...], ... },
  { type: 'gitlab-project-mrs-fetched-event', mrs: {...}, forProjectPath: '...', ... },
  ...
]
```

**Note:** If you need the timestamp later, parse it from the filename.

### Task 2.2: appendEvent()

**Write event to next numbered file:**

```typescript
/**
 * Append event to log with next sequential number
 * Returns the event number assigned
 */
export const appendEvent = (event: Event): Effect<number>
```

**Implementation:**
1. Read `events/` directory
2. Find highest event number (e.g., max = 5)
3. nextNumber = max + 1 (e.g., 6)
4. Generate timestamp:
   ```typescript
   const timestamp = new Date().toISOString(); // "2025-11-08T14:30:25.123Z"
   const fileTimestamp = timestamp.replace(/:/g, '-'); // "2025-11-08T14-30-25.123Z"
   ```
5. filename = `{nextNumber}_{fileTimestamp}_{event.type}.json`
6. Write JSON.stringify(event) to file (just the event, nothing else)
7. Return nextNumber

**Example:**
```typescript
// Highest existing file: 42_2025-11-08T14-30-00-000Z_gitlab-user-mrs-fetched-event.json
const eventNumber = yield* appendEvent({
  type: 'gitlab-project-mrs-fetched-event',
  mrs: projectMrsQuery,
  forProjectPath: 'elab/elab',
  forState: 'opened'
});
// Writes: 43_2025-11-08T14-35-12-456Z_gitlab-project-mrs-fetched-event.json
// Returns: 43
```

## Event File Format

**File contains ONLY the event data (no wrapper):**

```json
{
  "type": "gitlab-user-mrs-fetched-event",
  "mrs": {
    "data": {
      "user": {
        "assignedMergeRequests": {
          "nodes": [...]
        }
      }
    }
  },
  "forUsernames": ["john.doe"],
  "forState": "opened"
}
```

**Metadata is in the filename:**
- Event number: First part of filename (`5_...`)
- Timestamp: Second part of filename (`..._2025-11-08T14-30-25.123Z_...`)
- Event type: Third part of filename (`..._gitlab-user-mrs-fetched-event.json`)

## Storage Location

Use existing storage pattern:
```
storage/
  events/
    0_2025-11-08T10-30-00-000Z_gitlab-user-mrs-fetched-event.json
    1_2025-11-08T10-35-12-456Z_gitlab-project-mrs-fetched-event.json
    ...
```

Reference `src/services/mergeRequestStorage.ts` for storage path patterns.

## Files to Create/Modify

### New Files
- `src/events/eventStorage.ts` - `loadEvents()` and `appendEvent()` functions

### Existing Files (reference only)
- `src/events/events.ts` - Event union type (already exists)
- `src/events/gitlab-events.ts` - GitLab event types (already exists)
- `src/events/bitbucket-events.ts` - Bitbucket event types (already exists)
- `src/events/jira-events.ts` - Jira event types (already exists)
- `src/services/mergeRequestStorage.ts` - Storage path patterns

## Usage Pattern

### Appending Events
```typescript
// In fetch functions - after fetching data
const projectMrsQuery = yield* fetchProjectMRs('elab/elab', 'opened');

yield* appendEvent({
  type: 'gitlab-project-mrs-fetched-event',
  mrs: projectMrsQuery,
  forProjectPath: 'elab/elab',
  forState: 'opened'
});
```

### Loading Events
```typescript
// For projection
const allEvents = yield* loadEvents();

// Events are already sorted by number (time order)
for (const event of allEvents) {
  // Process event based on type
  if (event.type === 'gitlab-user-mrs-fetched-event') {
    // ...
  }
}
```

## Success Criteria

- ✅ `appendEvent()` creates sequentially numbered files
- ✅ File names include event type for readability
- ✅ `loadEvents()` reads all events in order
- ✅ JSON parsing works for all event types
- ✅ Event numbers have no gaps
- ✅ Works on Windows and macOS

## Implementation Notes

**Simplicity:**
- No index file needed (just read directory)
- No wrapper object (file = event JSON directly)
- Metadata in filename (number + timestamp + type)
- Finding next number = scan directory for max

**Error Handling:**
- If directory doesn't exist, create it
- If no events exist, start at 0
- Invalid JSON files should log error but not crash
- Missing event files (gaps) should log warning

**Performance:**
- Finding next number: O(n) where n = number of events
- Loading all events: O(n) - acceptable for projection
- For 1000 events ~50ms, for 10000 events ~500ms
- Can optimize later if needed

## Next Phase

Phase 3 (Response Normalization) will:
- Call `loadEvents()` to get all events
- Process each event based on its `type`
- Extract and normalize MRs from different event types
- Build projection from normalized data
