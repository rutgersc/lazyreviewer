# Effect-Based Console Logging Implementation Plan

## Goal
Replace ConsolePane's global console patching hack with a proper Effect-based logging system that integrates with effect-atom.

## User Decisions
- **Scope**: Only capture Effect Console (Console.log), not global console.log
- **No global patching**: Keep Effect pure, no bridging to global console

## Architecture Overview

### Components
1. **LogStorage Service**: Effect service that holds a `SubscriptionRef<LogEntry[]>` and provides an `addLog` method
2. **ConsoleLogged Layer**: Wraps Effect's `Console` service to intercept and log calls to LogStorage
3. **consoleLogsAtom**: Atom that reads from LogStorage's SubscriptionRef for reactive updates
4. **ConsolePane**: React component that uses the atom to display logs (removes all global console patching)

### Data Flow
```
Effect Console.log → ConsoleLogged → LogStorage.addLog → SubscriptionRef → consoleLogsAtom → ConsolePane
```

## Implementation Phases

### Phase 1: Create LogStorage Service
**File**: `src/services/logStorage.ts` (new)

Create an Effect service that:
- Manages a `SubscriptionRef<LogEntry[]>` (max 100 entries)
- Provides `addLog(level, message)` method
- Exports `LogEntry` interface

```typescript
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}
```

### Phase 2: Create ConsoleLogged Layer
**File**: `src/services/consoleLogged.ts` (new)

Create a layer that:
- Wraps the default Console service
- Intercepts log/warn/error/debug methods
- Formats arguments (stringify objects)
- Calls both the original console AND LogStorage.addLog
- Delegates all other Console methods unchanged

Pattern: Similar to `MergeRequestStorageLogged`

### Phase 3: Update App Layer Runtime
**File**: `src/store/appLayerRuntime.ts`

Add:
- Import LogStorage and ConsoleLogged
- Create `logStorageLayer = LogStorage.Default`
- Create `consoleLoggedLayer` with dependencies
- Provide consoleLoggedLayer to mergeRequestWithLoggingLayer
- This ensures all Effect Console usage goes through our wrapped version

### Phase 4: Create Console Logs Atom
**File**: `src/store/appAtoms.ts`

Add:
- Import LogStorage
- Create atom: `appAtomRuntime.subscriptionRef(Effect.map(LogStorage, service => service.logsRef))`
- Export LogEntry type (re-export from logStorage)

The SubscriptionRef automatically provides reactive updates to the atom.

### Phase 5: Update ConsolePane
**File**: `src/components/ConsolePane.tsx`

Changes:
- Remove all useState/useEffect console patching code
- Import and use `useAtomValue(consoleLogsAtom)`
- Handle Result type properly (onInitial/onSuccess/onFailure)
- Keep all UI rendering logic unchanged (getLogColor, scrollbox, etc.)

### Phase 6: Optional Migration
Convert strategic `console.log` calls to Effect `Console.log`:
- `src/gitlab/gitlabgraphql.ts` - Main API logs
- `src/bitbucket/bitbucketapi.ts` - Main API logs
- Already done: `src/mergerequests/*.ts` ✓

## Benefits
1. ✅ No global console patching - pure Effect solution
2. ✅ Type-safe logging with LogEntry interface
3. ✅ Reactive updates via SubscriptionRef
4. ✅ Consistent pattern with MergeRequestStorageLogged
5. ✅ Clean separation of concerns (Effect services vs React)

## Trade-offs
- Only Effect `Console.log` calls appear in ConsolePane
- Global `console.log` won't be captured (intentional)
- Some code may need migration to show logs in pane

## Dependencies
- Effect (Console, SubscriptionRef, Layer, Effect)
- @effect-atom/atom-react (appAtomRuntime.subscriptionRef)

## Testing
After implementation:
1. Run the app, open ConsolePane
2. Verify MR cache logs appear ("Cache Hit", "Cache MISS", etc.)
3. Verify MR Storage logs appear ("get", "set", "invalidate")
4. Verify no React errors about hooks/re-renders
5. Verify logs are limited to 100 entries
6. Verify timestamps and color coding work
