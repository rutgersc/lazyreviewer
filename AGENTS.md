# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

LazyGitLab is a terminal-based application for viewing GitLab merge requests with Jira integration. The app displays merge requests in a TUI (Terminal User Interface) with keyboard navigation and fetches associated Jira tickets.

## Development Commands

**IMPORTANT: NEVER run `bun run start` as it interferes with the Claude Code interface.**

**Type checking:**
```bash
bun run typecheck
```
Uses TypeScript for validation.

**GraphQL code generation:**
```bash
bun run codegen
```
Generates TypeScript types and operations from GraphQL schema at `git.elabnext.com/api/graphql`.

**Install dependencies:**
```bash
bun install
```

## Architecture

### Core Technologies
- **Bun** as runtime and build tool with custom `build.ts` configuration
- **GraphQL Code Generator** for type-safe GitLab API operations
- **TypeScript** with strict configuration

## Development Notes

### Library Source Code (CRITICAL)

**The following libraries have their source code available as git submodules in the `vendor/` directory:**
**critical: use the vendor folder to search through the libraries instead of the one in node_modules**

| Library | Submodule Path | Package |
|---------|---------------|---------|
| openTUI (UI renderer) | `vendor/opentui` | `@opentui/core`, `@opentui/react` |
| effect-atom | `vendor/effect-atom` | `@effect-atom/atom-react` |
| Effect-TS | `vendor/effect` | `effect`, `@effect/platform`, `@effect/schema` |
| Effect examples | `vendor/effect-examples` | (reference implementations) |

**MANDATORY: Before doing ANY work involving these libraries, you MUST:**

1. **Check if submodules are cloned**: Run `git submodule status` to verify. If any submodule shows a `-` prefix (not initialized) or the directory is empty, clone it first.

2. **Clone missing submodules**: If not cloned, run:
   ```bash
   git submodule update --init --depth 1 vendor/<submodule-name>
   ```
   Or to clone all: `git submodule update --init --depth 1`

3. **Always consult the source**: When implementing features, debugging, or answering questions about these libraries:
   - Read the actual source code in `vendor/` to understand implementation details
   - Check types, function signatures, and behavior directly from source
   - Look at examples in `vendor/effect-examples` for usage patterns
   - Do NOT rely solely on documentation or assumptions—verify against the source

**Why this matters**: These are the exact versions used by this project. Online documentation may differ from the pinned versions. The source is the authoritative reference.

!IMPORTANT!: This app is a terminal TUI (openTUI), not a web app—no browser runtime concerns; focus on TUI/event-loop behavior.

### Type-Driven Development

See **[Type-Driven Development](docs/type-driven-development.md)** for detailed guidance.

**Key rules:**
- **NEVER use `any`** - it shuts off typing entirely
- **NEVER use type assertions** (`as TypeName`) - fix the underlying type issue instead
- Always examine existing types before modifying code
- Design new types before implementation
- Run `bun run typecheck` frequently

### Code Organization and Separation of Concerns

**Only isolate code according to dependencies and responsibilities:**

1. **Extract components**: Components that operate independently should be in separate modules:

2. **Components and state**: React components should focus on UI logic:
   - **NEVER duplicate state**: The same logical state must exist in exactly one place
   - **Single source of truth**: Each piece of data has exactly one authoritative location
   - **Use existing state directly**: If state exists elsewhere (store, parent), use it directly - never copy
   - Don't bundle up state into an interface unless all of it is within the scope of one file. Prefer tracking individual properties regardless.


### State Update Crash Prevention

**CRITICAL: Clear-Delay-Set Pattern for State Updates**

When updating large state objects (especially `mergeRequests`), directly overwriting the data can cause crashes. To prevent this:

**Always use the clear-delay-set pattern:**
1. Clear the state to empty values (`[]`, `new Map()`, etc.)
2. Add a 100ms delay (`await new Promise(resolve => setTimeout(resolve, 100))`)
3. Set the new state values

**Example implementation:**
```typescript
// ✅ CORRECT: Clear-delay-set pattern
async switchUserSelection(entry: number) {
  // 1. Clear state first
  set({ mergeRequests: [], branchDifferences: new Map() });

  // 2. Delay to prevent crashes
  await new Promise(resolve => setTimeout(resolve, 100));

  // 3. Set new values
  set({ selectedUserSelectionEntry: entry, selectedMergeRequest: 0 });
  // ... load new data
}
```

**When to use this pattern:**
- Switching between user selections
- Fetching/refreshing merge requests
- Any operation that replaces large arrays or maps in the store
- Any state update that previously caused intermittent crashes

**Why this works:**
- Gives the UI renderer time to process the empty state before new data arrives
- Prevents race conditions between state updates and rendering
- Avoids memory/rendering issues from rapid state replacements

### Code Style

**Immutable FP Style (MANDATORY):**
- **ALWAYS use `map`/`filter`/`reduce`** instead of `for` loops or `forEach` with mutations
- **NEVER mutate** - always create new values instead of modifying existing ones
- Prefer expression-based code (returns values) over statement-based code (performs effects)

```typescript
// ❌ BAD: Imperative loop with mutation
const results: T[] = []
for (const item of items) {
  if (condition(item)) {
    results.push(transform(item))
  }
}

// ✅ GOOD: Declarative FP chain
const results = items
  .filter(condition)
  .map(transform)
```

**Other Style Guidelines:**
- Favor functions with parameters over classes
- Favor small pure functions with clear input/output
- DONT use INLINE imports via require. Always import top level

### React Patterns

See **[React Patterns](docs/react-patterns.md)** for detailed guidance.

**Key rule:** useEffect is a code smell. If you control the setter, trigger side effects there, not in useEffect.

### Code Quality Guidelines

**Post-Coding Review Process:**
After completing any coding session, ALWAYS apply the **[Functional Simplification Principles](docs/functional-simplification.md)**:
1. **Pure function extraction**: Can effectful functions be split into pure logic + effectful caller?
2. **Loop fusion**: Am I traversing the same data multiple times?
3. **Replace mutation with transformation**: Can push/add/set be replaced with filter→map→filter pipelines?
4. **Use appropriate data structures**: Would a Set/Map eliminate manual tracking?
5. **Separation of concerns**: Does each function have a single responsibility?
6. **Identify code duplication**: Look for repeated patterns that can be extracted
7. **Consolidate similar functions**: If multiple functions do similar things, unify them with parameters

**Code Reuse and Deduplication:**

**CRITICAL: Always check for code duplication BEFORE and AFTER making changes.**

Less code is better. When implementing features:

1. **Before implementing**: Scan for existing similar patterns
   - Are there functions/atoms that do something similar?
   - Can existing code be extended instead of duplicated?
   - Is there a parallel pattern that suggests abstraction?j

2. **After implementing**: Review for unification opportunities
   - Look for code that reads from the same source multiple times
   - Identify separate state tracking the same underlying data
   - Spot parallel implementations that differ only in parameters. Extract the common part to a parameterized function.

3. **Apply the Single Source of Truth principle**:
   - ❌ BAD: Multiple atoms/functions accessing the same cache/state separately
   - ✅ GOOD: One unified source, derive specialized views from it
   - ❌ BAD: Separate loading states for initial load vs refresh
   - ✅ GOOD: Single loading atom that covers all loading scenarios

**Real example from this codebase:**
```typescript
// ❌ BEFORE: Double cache access
fetchUserMRsWithCache() → returns data only
getLastRefreshTimestamp() → reads same cache for timestamp only
mrsByKeyAtomFamily → for data
lastRefreshTimestampByKeyAtomFamily → for timestamp

// ✅ AFTER: Single cache access
fetchUserMRsWithCache() → returns { data, timestamp }
mrsCacheByKeyAtomFamily → single source
mergeRequestsAtom → derives .data
lastRefreshTimestampAtom → derives .timestamp
```

**Rule of thumb**: If you're reading the same data twice or tracking the same concept in multiple places, consolidate into one source and derive views from it.

**Comment Policy:**
- **NEVER add excessive comments** - code should be self-documenting
- **NO explanatory comments** for obvious operations
- **NO code summaries** - avoid "what this does" comments
- **ONLY add comments for**: business logic context, non-obvious algorithms, or external API quirks
- **Prefer**: descriptive variable names, clear function names, and well-structured code over comments

### UI Guidelines

See **[UI Guidelines](docs/ui-guidelines.md)** for colors, openTUI specifics, and component patterns.

**Key rules:**
- Use Dracula theme palette, avoid `#6272a4` (grey) - use `#bd93f9` instead
- In openTUI, use `'return'` not `'enter'` for key handling
- Always show discussion counts as resolved/resolvable format (e.g., "💬 3/5")