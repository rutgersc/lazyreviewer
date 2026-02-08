# LazyGitLab

Terminal-based TUI for viewing GitLab merge requests with Jira integration.

## Development Commands

- **NEVER run `bun run start`** — it interferes with the Claude Code interface.
- **ALWAYS use `bun run typecheck`** for type checking. NEVER run `tsc` directly.
- **ALWAYS use `bun run codegen`** for GraphQL code generation. NEVER run codegen commands manually.
- **ALWAYS use `bun install`** for dependencies. NEVER use `npm install` or `yarn`.

## Architecture

- **Bun** as runtime and build tool with custom `build.ts` configuration
- **GraphQL Code Generator** for type-safe GitLab API operations
- **TypeScript** with strict configuration
- **This is a terminal TUI (openTUI), NOT a web app** — no browser runtime concerns; focus on TUI/event-loop behavior.

## Library Source Code (CRITICAL)

**NEVER search `node_modules` for these libraries. ALWAYS use the `vendor/` folder.**

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

3. **Always consult the library sourcecode**: When implementing features, debugging, or answering questions about these libraries:
   - Read the actual source code in `vendor/` to understand implementation details
   - Check types, function signatures, and behavior directly from source
   - Look at examples for usage patterns
   - Do NOT rely solely on documentation or assumptions—verify against the actual sourcecode

**Why this matters**: These are the exact versions pinned by this project. Online documentation may differ. The vendor source is the authoritative reference.

## Type-Driven Development

See **[Type-Driven Development](docs/type-driven-development.md)** for detailed guidance.

- **NEVER use `any` as a type** — it disables typing entirely.
- **NEVER use type assertions** (`as TypeName`) — fix the underlying type issue instead.
- **ALWAYS examine existing types** before modifying code.
- **ALWAYS run `bun run typecheck`** after making changes.

## Code Organization

- **NEVER duplicate state** — the same logical state MUST exist in exactly one place.
- **ALWAYS use existing state directly** — if state exists elsewhere (store, parent), use it directly, never copy it.
- **NEVER bundle state into an interface** unless all of it is scoped to one file. Track individual properties instead.

## Code Style

**Immutable FP Style (MANDATORY):**
- **ALWAYS use `map`/`filter`/`reduce`** instead of `for` loops or `forEach` with mutations
- **PREFER IMMUTABLE OVER MUTABLE** - always create new values instead of modifying existing ones
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

**Effect-TS Style:**
- **ALWAYS use `Effect.gen`** for effect composition — never use `Effect.andThen` chains as an alternative

**Other Style Rules:**
- **ALWAYS use functions with parameters** over classes.
- **ALWAYS favor small pure functions** with clear input/output. Reuse existing pure functions before writing new logic.
- **NEVER use inline imports** (e.g. `require()`). ALWAYS import at the top level.

## React Patterns

See **[React Patterns](docs/react-patterns.md)** for detailed guidance.

- **NEVER use `useEffect` for side effects you control.** If you control the setter, trigger side effects there, not in useEffect. `useEffect` is a code smell.

## Code Quality

**ALWAYS apply these checks after completing any coding session:**
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
   - Is there a parallel pattern that suggests abstraction?

2. **After implementing**: Review for unification opportunities
   - Look for code that reads from the same source multiple times
   - Identify separate state tracking the same underlying data and look to making it one
   - Spot parallel implementations that differ only in parameters. Extract the common part to a parameterized function.

3. **Apply the Single Source of Truth principle**:
   - ❌ BAD: Multiple atoms/functions accessing the same mutable cache/state separately
   - ✅ GOOD: One unified source, derive specialized views from it
   - ❌ BAD: Separate loading states for initial load vs refresh
   - ✅ GOOD: Single loading atom that covers all loading scenarios

**Rule of thumb**: If you're reading the same data twice or tracking the same concept in multiple places, consolidate into one source and derive views from it.

**Comment Policy:**
- **NEVER add comments for obvious operations** — code should be self-documenting.
- **NEVER add code summaries** ("what this does" comments).
- **ONLY add comments for**: business logic context, non-obvious algorithms, or external API quirks.

## UI Guidelines

See **[UI Guidelines](docs/ui-guidelines.md)** for colors, openTUI specifics, and component patterns.

- **ALWAYS use the Dracula theme palette.** NEVER use `#6272a4` (grey) — use `#bd93f9` instead.
- **Keyboard is primary** (vim-style j/k, arrows, Enter), but consider mouse where it makes sense (click to select, double-click to activate).
