# Functional Simplification Principles

This document outlines systematic approaches to simplifying code after implementation. Apply these principles during post-coding review to improve clarity, maintainability, and correctness.

## Core Philosophy

**Make the happy path obvious. Let data flow through transformations rather than being mutated in place.**

## Principles

### 1. Pure Function Extraction

Move side effects to the edges, keep core logic pure.

```typescript
// ❌ Effectful function that does too much
const processAndSend = (state, get) => {
  const data = extractData(state);
  const settings = get.registry.get(settingsAtom);
  if (settings.enabled) {
    sendNotification(data);
    persistState(data.id);
  }
}

// ✅ Pure function + effectful orchestration
const stateToPayload = (state, context): Payload | undefined => {
  // Pure: data in, data out
  return transformData(state, context);
}

// Caller handles effects
const payload = stateToPayload(state, context);
if (payload) {
  yield* sendNotification(payload);
}
persistState(lastEventId);
```

**Questions to ask:**
- Can this function return data instead of performing effects?
- Can the caller handle the side effects?
- Is this function testable without mocking?

### 2. Loop Fusion

Combine multiple passes over the same data into one.

```typescript
// ❌ Two passes
const lastMrEvent = chunk.findLast(isMrEvent);
const lastJiraEvent = chunk.findLast(isJiraEvent);

// ✅ Single pass
const { lastMrId, lastJiraId } = Chunk.reduce(
  chunk,
  { lastMrId: undefined, lastJiraId: undefined },
  (acc, state) => ({
    lastMrId: isMrEvent(state.event) ? state.event.id : acc.lastMrId,
    lastJiraId: isJiraEvent(state.event) ? state.event.id : acc.lastJiraId
  })
);
```

**Questions to ask:**
- Am I traversing the same collection multiple times?
- Can I collect all needed information in one pass?

### 3. Replace Mutation with Transformation

Use declarative pipelines instead of imperative mutation.

```typescript
// ❌ Mutation with conditionals
const processedIds = new Set<string>();
const payloads: Payload[] = [];

if (Option.isSome(mrState) && mrState.value.event) {
  processedIds.add(mrState.value.event.id);
  const payload = toPayload(mrState.value);
  if (payload) payloads.push(payload);
}

if (Option.isSome(jiraState) && jiraState.value.event) {
  if (!processedIds.has(jiraState.value.event.id)) {
    const payload = toPayload(jiraState.value);
    if (payload) payloads.push(payload);
  }
}

// ✅ Declarative pipeline
const targetIds = new Set([lastMrId, lastJiraId].filter(Boolean));

const payloads = items
  .filter(state => state.event && targetIds.has(state.event.id))
  .map(state => toPayload(state, context))
  .filter((p): p is Payload => p !== undefined);
```

**Questions to ask:**
- Am I using `.push()` or `.add()` inside conditionals?
- Can this be expressed as filter → map → filter?
- Is there manual duplicate tracking that a Set could handle?

### 4. Use Appropriate Data Structures

Let data structures handle complexity instead of manual bookkeeping.

```typescript
// ❌ Manual duplicate tracking
const processedIds = new Set<string>();
if (Option.isSome(a)) {
  processedIds.add(a.value.id);
  process(a);
}
if (Option.isSome(b) && !processedIds.has(b.value.id)) {
  process(b);
}

// ✅ Set handles deduplication naturally
const targetIds = new Set([a?.id, b?.id].filter(Boolean));
// Filter by set membership - duplicates impossible
items.filter(item => targetIds.has(item.id))
```

**Questions to ask:**
- Am I manually tracking "have I seen this before"?
- Would a Set or Map simplify this logic?
- Can the data structure enforce the invariant I'm checking manually?

### 5. Separation of Concerns

Each function should have one reason to change.

```typescript
// ❌ Mixed concerns
const processNotification = (state, get) => {
  const deltas = getDeltas(state);
  persistEventId(state.event.id);  // Persistence
  if (!isEnabled(get)) return;     // Settings check
  const payload = buildPayload(deltas);
  sendNotification(payload);       // Side effect
}

// ✅ Separated concerns
// Pure: state → payload
const stateToPayload = (state, context): Payload | undefined => { ... }

// Orchestration handles settings, persistence, sending
if (notificationsEnabled) {
  const payload = stateToPayload(state, context);
  if (payload) yield* sendNotification(payload);
}
persistEventId(lastEventId);
```

**Questions to ask:**
- Does this function do more than one thing?
- Who is responsible for persistence? For settings checks? For side effects?
- Can I name this function with a single verb?

### 6. Eliminate Option/null Checks Through Structure

Design data flow so checks happen once, upstream.

```typescript
// ❌ Repeated Option checks
if (Option.isSome(lastMrEventId) && state.event.id === lastMrEventId.value) { ... }
if (Option.isSome(lastJiraEventId) && state.event.id === lastJiraEventId.value) { ... }

// ✅ Build a structure that eliminates checks
const targetIds = new Set(
  [lastMrId, lastJiraId].filter((id): id is string => id !== undefined)
);
// Now just: targetIds.has(id) - no Option checks needed
```

## Post-Coding Review Checklist

After completing an implementation, ask:

1. **Pure functions**: Can any effectful function be split into pure logic + effectful caller?
2. **Loop fusion**: Am I traversing the same data multiple times?
3. **Mutation**: Am I using push/add/set inside loops or conditionals?
4. **Data structures**: Would a Set/Map eliminate manual tracking?
5. **Concerns**: Does each function have a single responsibility?
6. **Null checks**: Can I restructure to check once instead of repeatedly?

## Related Concepts

- **Functional programming**: immutability, pure functions, composition
- **Refactoring patterns**: "Replace Loop with Pipeline", "Extract Pure Function"
- **Equational reasoning**: transformations that preserve behavior while simplifying structure
- **Deforestation**: eliminating intermediate data structures
