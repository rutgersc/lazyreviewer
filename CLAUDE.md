# LazyReviewer

A Terminal user interface (TUI) that provides an overview of pull requests and helps managing the checked out branches/worktrees.

## Development Commands

- **NEVER run `bun run start`** — it interferes with the Claude Code interface.
- **NEVER dismiss typecheck errors** — if there are errors, investigate and fix them or ask the user. Do not assume errors are "pre-existing".
- **ALWAYS use `bun run codegen`** for GraphQL code generation. NEVER run codegen commands manually.
- **ALWAYS use `bun install`** for dependencies. NEVER use `npm install` or `yarn`.

## Architecture

- **Bun** as runtime and build tool with custom `build.ts` configuration
- **GraphQL Code Generator** for type-safe GitLab API operations
- **TypeScript** with strict configuration
- **This is a terminal TUI (openTUI), NOT a web app** — no browser runtime concerns; focus on TUI/event-loop behavior.

## Library Source Code (CRITICAL)

**NEVER search `node_modules` for these libraries. ALWAYS read `reference-source/` instead of web searches** (docs may not match our pinned versions). If a folder is missing, clone it:

```bash
git clone --depth 1 https://github.com/sst/opentui.git reference-source/opentui
git clone --depth 1 https://github.com/Effect-TS/effect.git reference-source/effect
```

| Library | Reference Path | Package |
|---------|---------------|---------|
| openTUI (UI renderer) | `reference-source/opentui` | `@opentui/core`, `@opentui/react` |
| Effect-TS | `reference-source/effect` | `effect`, `@effect/platform`, `@effect/schema`, `@effect-atom/atom-react` |

When implementing features, debugging, or answering questions about these libraries:
- Read the actual source code in `reference-source/` to understand implementation details
- Check types, function signatures, and behavior directly from source
- Look at examples for usage patterns

## UI Guidelines

See **[UI Guidelines](docs/ui-guidelines.md)** for colors, openTUI specifics, and component patterns.

- **ALWAYS use the Dracula theme palette.** NEVER use `#6272a4` (grey) — use `#bd93f9` instead.
- **Keyboard is primary** (vim-style j/k, arrows, Enter), but consider mouse where it makes sense (click to select, double-click to activate).
