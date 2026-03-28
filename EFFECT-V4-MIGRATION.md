# Effect v4 Migration Tracker

Tracking progress upgrading from Effect v3 to v4.0.0-beta.42.

**Branch:** `effect-v4`
**Starting errors:** 1,479
**Current errors:** 711

## Completed

- [x] Package upgrades (`effect@4.0.0-beta.42`, `@effect/atom-react@4.0.0-beta.42`, `@effect/platform-node@4.0.0-beta.42`)
- [x] Remove consolidated packages (`@effect/platform`, `@effect/schema`, `@effect/experimental`, `@effect/language-service`)
- [x] Fix codegen plugin: `Schema.Union(A, B)` → `Schema.Union([A, B])`
- [x] Regenerate `gitlab-base-types.schema.ts`
- [x] `Effect.catchAll` → `Effect.catch`
- [x] `Effect.catchAllCause` → `Effect.catchCause`
- [x] `Effect.fork` → `Effect.forkChild`
- [x] `Effect.forkDaemon` → `Effect.forkDetach`
- [x] `@effect-atom/atom-react` → `@effect/atom-react`
- [x] `Atom`, `Result`, `Registry` → imports from `effect/unstable/reactivity`
- [x] `Result` → `AsyncResult`, `Registry` → `AtomRegistry`

## Remaining

### Service pattern rewrite (~125 errors, high priority)

`Effect.Service` and `Context.Tag` proxy accessors removed in v4. Services no longer expose static methods like `SettingsService.modify(...)` or `EventStorage.appendEvent(...)`. Need to migrate to `ServiceMap.Service` with explicit `yield*` access.

Affected services: `EventStorage`, `SettingsService`, `UserSettingsService`, `MrStateService`, `BackgroundSyncService`, `DiscussionScrollService`, `JiraScrollService`

Also: `yield*` on services/Ref/Deferred no longer auto-unwraps — need `Ref.get(ref)`, `Deferred.await(deferred)`, `Fiber.join(fiber)`.

### Schema changes (~40 errors, medium priority)

- `Schema.optionalWith` → `Schema.optional` (new API shape, 26 errors)
- `Schema.Record({key, value})` → `Schema.Record(key, value)` (8 errors)
- `Schema.transform` → `Schema.decodeTo()` (5 errors)
- `Schema.decodeUnknown` / `Schema.annotations` renames

### Runtime changes (~7 errors, medium priority)

- `Runtime.make` / `Runtime.defaultRuntime` / `Runtime.runPromise` restructured
- `Effect.runtime<R>()` → `Effect.services<R>()`

### Stream changes (~3 errors)

- `Stream.unwrapScoped` removed → `Stream.unwrap` (absorbs scope)

### exactOptionalPropertyTypes mismatches (~37 errors, low priority)

Likely from openTUI types being stricter with v4's Schema output types. May need upstream fix or type narrowing at call sites.

### Codegen plugin loading

Both custom codegen plugins (`codegen-plugin-effect-schema.ts`, `codegen-plugin-effect-schema-base-types.ts`) fail to load via graphql-codegen due to ESM/CJS mismatch. Pre-existing issue, not caused by v4 upgrade. The base-types fix was applied directly to the generated file.

## Migration references

- [effect-smol migration guide](https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md)
- [v4 beta announcement](https://effect.website/blog/releases/effect/40-beta/)
- Key migration docs: services.md, schema.md, error-handling.md, forking.md, yieldable.md, runtime.md, cause.md
