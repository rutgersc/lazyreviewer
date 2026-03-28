# Effect v4 Migration Tracker

Tracking progress upgrading from Effect v3 to v4.0.0-beta.42.

**Branch:** `effect-v4`
**Starting errors:** 1,479
**Current errors:** 206

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
- [x] `Effect.Service<Self>()("id", { accessors: true, effect: ... })` → `ServiceMap.Service<Self>()("id", { make: ... })`
- [x] `Context.Tag("id")<Self, Shape>()` → `ServiceMap.Service<Self, Shape>()("id", { make: ... })`
- [x] Service static accessors (`ServiceClass.method()`) → bind with `yield* ServiceClass` then call on instance
- [x] `.Default` layer accessor → `Layer.effect(ServiceClass)(ServiceClass.make)`
- [x] `Runtime.make` / `Runtime.defaultRuntime` / `Runtime.runPromise(runtime)` → `Effect.runPromiseWith(serviceMap)`
- [x] `getAppRuntime()` → `getAppServiceMap()` / `runWithAppServices()`
- [x] `Stream.unwrapScoped` → `Stream.unwrap`
- [x] `Array.partitionMap` → `Array.partition` (uses `Result` instead of `Either`)
- [x] `Effect.validateAll` → `Effect.validate`
- [x] `Effect.either` → `Effect.exit`, `Either.match` → `Exit.match`
- [x] `Either` → `Result` (Either removed in v4)
- [x] `Effect.fork` → `Effect.forkChild`
- [x] `stateRef.changes` → `SubscriptionRef.changes(stateRef)`
- [x] `Schema.Union` multi-arg calls in event schemas (gitlab, bitbucket, jira)
- [x] `AsyncResult.Result<A, E>` → `AsyncResult.AsyncResult<A, E>`
- [x] `Stream.catchAll` → `Stream.catch`
- [x] `Schedule.recurWhile` → `Schedule.while`, `Schedule.intersect` → `Schedule.both`
- [x] `Chunk.unsafeGet` → `Chunk.headUnsafe`
- [x] `Effect.orElse` → `Effect.catch`
- [x] `AsyncResult.isResult` → `AsyncResult.isAsyncResult`
- [x] `ParseError` (from `effect/ParseResult`) → `SchemaError` (from `effect/Schema`)
- [x] `@effect/platform-node/NodeCommandExecutor` → `@effect/platform-node/NodeServices`
- [x] `FileSystem`, `Path` from `@effect/platform` → from `effect`
- [x] `Layer.Layer.Success` → `Layer.Success`

## Remaining

### Layer composition has `unknown` context leak (~40 errors, high priority)

`appLayer` resolves with `RIn = unknown` instead of `never`, meaning some layer dependency is unsatisfied. This cascades to `appAtomRuntime` which then causes "Missing 'unknown' in the expected Effect context" in all consumer atoms. Root cause is likely one of the service `make:` effects having an unresolved dependency.

### Command/open-file API migration (~5 errors)

`@effect/platform` `Command` API replaced by `ChildProcess.make` tagged template literal in v4. `src/utils/open-file.ts` needs rewrite.

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
