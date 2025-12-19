# React Patterns

## useEffect is a Code Smell

**useEffect should be avoided unless there is NO OTHER WAY.**

### The Antipattern

**NEVER use useEffect to react to state changes when you control the setter.**

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

### The Correct Approach

**Trigger side effects directly in the setter/action where state is updated.**

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

### When useEffect IS Acceptable

- Component mount/unmount lifecycle (start/stop timers, subscriptions)
- Reacting to external events you don't control (window resize, external library callbacks)
- **ONLY when you have exhausted all other options**

### Why This Matters

- useEffect creates hidden dependencies and makes code harder to follow
- You lose explicit control flow - it's reactive magic instead of clear causation
- It can cause unnecessary re-renders and performance issues
- The execution order becomes unclear and hard to reason about

**Rule of thumb:** If you KNOW where the state is being set (you control the setter), trigger side effects THERE, not in useEffect.
