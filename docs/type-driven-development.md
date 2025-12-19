# Type-Driven Development

**ALWAYS start with types before making code changes.**

## Critical Rules

- **AVOID `any`** - it shuts off typing entirely. Never use `any` to fix type errors.
- **NEVER use type assertions** (`as TypeName`) to satisfy the compiler - it disables type checking and masks real type errors. Always fix the underlying type issue instead.

## Process

### 1. Examine existing types first

Before modifying any code, read and understand the type definitions involved:
- Check interface definitions (e.g., `JiraIssue`, `GitlabMergeRequest`)
- Look at function signatures and their parameter/return types
- Understand component prop types

### 2. Validate type compatibility

Ensure your planned changes align with existing types:
- Does the data structure match what you're trying to access? (e.g., `issue.fields.summary` not `issue.summary`)
- Are you passing the correct types to functions and components?
- Do new props match the expected interface?

### 3. Design new types before implementation

For new features, define types first:
- Consider creating interfaces for new data structures
- Define component prop types upfront
- Consider type unions and optional properties

### 4. Use TypeScript as your guide

Let the type checker catch issues during development, not after:
- Run `bun run typecheck` frequently during development
- Address type errors immediately rather than fixing them post-implementation
- Use IDE type hints to understand available properties and methods

## Example

When adding a Jira modal:
1. First examine `JiraIssue` interface to understand `issue.fields.summary` structure
2. Then design `JiraModalProps` interface
3. Then implement the component
