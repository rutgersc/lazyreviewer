# Effect v4 Migration Tracker

Tracking progress upgrading from Effect v3 to v4.0.0-beta.42.

**Branch:** `effect-v4`
**Starting errors:** 1,479
**Current errors:** 450

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
- [x] `Schema.optionalWith(S, { default: () => X })` → `S.pipe(Schema.withDecodingDefaultKey(() => X))`
- [x] `Schema.Record({ key, value })` → `Schema.Record(key, value)` (positional args)
- [x] `Schema.transform(from, to, { decode, encode })` → `from.pipe(Schema.decodeTo(to, { decode: SchemaGetter.transform(fn), encode: SchemaGetter.transform(fn) }))`
- [x] `Schema.decodeUnknown(S)` (Effect) → `Schema.decodeUnknownEffect(S)`
- [x] `Schema.Literal('a', 'b', ...)` → `Schema.Literals(['a', 'b', ...])`
- [x] `Schema.Union(A, B)` → `Schema.Union([A, B])`
- [x] `Schema.mutable(Schema.Struct({...}))` → `mutableStruct({...})` via `mapFields` + `mutableKey`
- [x] `.annotations({...})` → `.pipe(Schema.annotate({...}))`
- [x] `Schema.fromBrand(Ctor)` → `Schema.fromBrand("id", Ctor)` (added identifier arg)

## Remaining

### Service pattern rewrite (~120 errors, high priority)

`Effect.Service` → `Effect.service` (lowercase) in v4. Services no longer expose static `.Default` layer accessor. Proxy accessors on service tags removed. Need to migrate consumer code to `yield*` access pattern.

Affected services: `EventStorage`, `SettingsService`, `UserSettingsService`, `MrStateService`, `BackgroundSyncService`, `DiscussionScrollService`, `JiraScrollService`, `PipelineJobMonitor`, `BgSyncReadModelService`

Also: `yield*` on services/Ref/Deferred no longer auto-unwraps — need `Ref.get(ref)`, `Deferred.await(deferred)`, `Fiber.join(fiber)`.

### Runtime changes (~7 errors, medium priority)

- `Runtime.make` / `Runtime.defaultRuntime` / `Runtime.runPromise` restructured
- `Effect.runtime<R>()` → `Effect.services<R>()`

### Other API renames (~10 errors)

- `Array.partitionMap` → `Array.partition`
- `Effect.validateAll` → `Effect.validate`
- `Stream.unwrapScoped` → `Stream.unwrap`

### Readonly Record mutation (2 errors, low priority)

`Schema.mutable()` in v4 only works on arrays/tuples. Records are readonly by default. Two sites in `settings.ts` mutate record contents in place — needs refactor to immutable update pattern.

### exactOptionalPropertyTypes mismatches (~76 errors, low priority)

From openTUI types, codegen plugins, and some internal code. May need upstream fix or type narrowing at call sites.

### Codegen plugin loading

Both custom codegen plugins (`codegen-plugin-effect-schema.ts`, `codegen-plugin-effect-schema-base-types.ts`) fail to load via graphql-codegen due to ESM/CJS mismatch. Pre-existing issue, not caused by v4 upgrade. The base-types fix was applied directly to the generated file.

## Migration references

- [effect-smol migration guide](https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md)
- [v4 beta announcement](https://effect.website/blog/releases/effect/40-beta/)
- Key migration docs: services.md, schema.md, error-handling.md, forking.md, yieldable.md, runtime.md, cause.md
