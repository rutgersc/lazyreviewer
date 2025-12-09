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

### Type-Driven Development Approach

**ALWAYS start with types before making code changes:**
**AVOID typing anything in typescript with `any`. Any shuts off typing, so don't ever use `any` at all. Absolutely never use any as a type to fix type errors.**
**REPEAT: Avoid typing with `any`. any is NOT recommended**
**NEVER use type assertions (`as TypeName`) to satisfy the compiler - it disables type checking and masks real type errors. Always fix the underlying type issue instead.**

1. **Examine existing types first**: Before modifying any code, read and understand the type definitions involved:
   - Check interface definitions (e.g., `JiraIssue`, `GitlabMergeRequest`)
   - Look at function signatures and their parameter/return types
   - Understand component prop types

2. **Validate type compatibility**: Ensure your planned changes align with existing types:
   - Does the data structure match what you're trying to access? (e.g., `issue.fields.summary` not `issue.summary`)
   - Are you passing the correct types to functions and components?
   - Do new props match the expected interface?

3. **Design new types before implementation**: For new features, define types first:
   - Consider creating interfaces for new data structures
   - Define component prop types upfront
   - Consider type unions and optional properties

4. **Use TypeScript as your guide**: Let the type checker catch issues during development, not after:
   - Run `bun run typecheck` frequently during development
   - Address type errors immediately rather than fixing them post-implementation
   - Use IDE type hints to understand available properties and methods

**Example**: When adding Jira modal, first examine `JiraIssue` interface to understand `issue.fields.summary` structure, then design `JiraModalProps` interface, then implement the component.

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

### Plan-Driven Development for Complex Features

**For significant new features, create implementation plans before coding:**

1. **Document in `.claude/plans/`**: Create detailed implementation plan with research findings and step-by-step approach
2. **Brief summary original prompt**: Capture the users intent.
3. **Define plan phases and tasks**: Clearly define each phase, subdivided by tasks. Number accordingly for example, "Phase 1: add new pane" "Task 1.1: do something"). Implement in logical order (types → utilities → components → integration). Describe for each task what other tasks it depends on and what it is that it depends on. Structure the phases and tasks according to the dependencies between them.

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

### React: CRITICAL useEffect Antipattern

**useEffect is a code smell and should be avoided unless there is NO OTHER WAY**

**NEVER use useEffect to react to state changes when you control the setter:**
- ❌ BAD: Using useEffect to trigger side effects when state changes
- ✅ GOOD: Trigger side effects directly in the setter/action where state is updated

**Example of the ANTIPATTERN (DO NOT DO THIS):**
```typescript
// ❌ BAD: Using useEffect to react to mergeRequests changes
useEffect(() => {
  if (mergeRequests.length > 0) {
    fetchBranchDifferences(mergeRequests).then(differences => {
      setBranchDifferences(differences);
    });
  }
}, [mergeRequests]);
```

**The CORRECT approach:**
```typescript
// ✅ GOOD: Trigger side effects in the setter itself
fetchMrs: async () => {
  const mrs = await fetchMergeRequests(...);
  set({ mergeRequests: mrs });

  // Trigger background work right here, where we KNOW mrs changed
  fetchBranchDifferences(mrs).then(differences => {
    set({ branchDifferences: differences });
  });
}
```

**When useEffect IS acceptable:**
- Component mount/unmount lifecycle (start/stop timers, subscriptions)
- Reacting to external events you don't control (window resize, external library callbacks)
- **ONLY when you have exhausted all other options**

**Why this matters:**
- useEffect creates hidden dependencies and makes code harder to follow
- You lose explicit control flow - it's reactive magic instead of clear causation
- It can cause unnecessary re-renders and performance issues
- The execution order becomes unclear and hard to reason about

**Rule of thumb:** If you KNOW where the state is being set (you control the setter), trigger side effects THERE, not in useEffect.

### Code Quality Guidelines

**Post-Coding Review Process:**
After completing any coding session, ALWAYS:
1. **Identify code duplication**: Look for repeated patterns, similar functions, or duplicated logic that can be extracted into reusable utilities
2. **Simplification opportunities**: Check if complex code can be simplified without losing functionality
3. **Refactor proactively**: Extract common patterns into hooks, utilities, or shared functions
4. **Consolidate similar functions**: If multiple functions do similar things, consider unifying them with parameters

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

### UI Color Guidelines
**NEVER use hard-to-read colors that reduce accessibility:**
- AVOID `#6272a4` (grey) - too dim and hard to read on dark backgrounds
- AVOID colors with low contrast ratios
- USE high-contrast colors from the Dracula theme palette:
  - `#f8f8f2` (foreground white)
  - `#bd93f9` (purple) - good alternative to grey
  - `#50fa7b` (green)
  - `#8be9fd` (cyan)
  - `#ffb86c` (orange)
  - `#ff5555` (red)
  - `#f1fa8c` (yellow)
- When in doubt, use `#bd93f9` instead of grey tones

**IMPORTANT ACCESSIBILITY RULE:**
- ALWAYS review all text colors in new components for readability
- Replace any instance of `#6272a4` with `#bd93f9` for better contrast
- Test readability by checking if text is easily visible against dark backgrounds

### openTUI info
- when handling keys via useKeyboard, 'enter' is not a keycode. 'enter' is 'return' instead.

### UI Component Guidelines
- **Discussion counts**: Always show resolved/resolvable format (e.g., "💬 3/5" or "💬 0/0") - do not special-case zero values with conditional rendering
- **MR row height**: The `useAutoScroll` hook's `itemHeight` parameter must match the actual number of rows rendered per MR item, otherwise keyboard navigation scrolling will be misaligned. When adding/removing rows from the MR display, update the `itemHeight` accordingly