# Phase 5: Filtering & User Selection as Filters

## Goal
Transform user selections from fetch drivers into client-side filters over projected MRs.

## Dependencies
- Phase 3 complete (projected MRs available)
- Phase 4 complete (syncing updates projection)

## Tasks

### Task 5.1: Filter Predicate Builder

**Convert user selections to filter functions:**

```typescript
// src/filtering/filterBuilder.ts

type FilterPredicate = (mr: MergeRequest) => boolean;

export const buildFilterPredicate = (
  selection: UserSelectionEntry
): FilterPredicate => {
  // Build predicate based on selection type
  const predicates = selection.selection.map(buildSinglePredicate);

  // Combine with OR (match any criteria)
  return (mr: MergeRequest) => {
    return predicates.some(predicate => predicate(mr));
  };
};

const buildSinglePredicate = (
  item: UserOrGroupId
): FilterPredicate => {
  if (item.type === 'userId') {
    return buildUserPredicate(item.id);
  } else if (item.type === 'groupId') {
    return buildGroupPredicate(item.id);
  } else if (item.type === 'repositoryId') {
    return buildRepositoryPredicate(item.id);
  }
  throw new Error(`Unknown selection type: ${item}`);
};

// Filter by author username
const buildUserPredicate = (username: string): FilterPredicate => {
  return (mr: MergeRequest) => {
    return mr.author.username === username;
  };
};

// Filter by group (expand to users)
const buildGroupPredicate = (groupId: string): FilterPredicate => {
  const usernames = expandGroupToUsernames(groupId);
  return (mr: MergeRequest) => {
    return usernames.includes(mr.author.username);
  };
};

// Filter by repository
const buildRepositoryPredicate = (repoId: string): FilterPredicate => {
  const { provider, projectPath } = parseRepositoryId(repoId);

  return (mr: MergeRequest) => {
    const mrId = getMRId(mr);
    const mrInfo = parseMRId(mrId);

    return (
      mrInfo.provider === provider &&
      mrInfo.projectPath === projectPath
    );
  };
};

// Expand group to list of usernames (from usersAndGroups.ts)
const expandGroupToUsernames = (groupId: string): string[] => {
  const group = groups.find(g => g.groupId === groupId);
  if (!group) return [];

  return group.userIds.map(uid => {
    const user = users.find(u => u.userId === uid);
    return user?.gitlabUsername || uid;
  }).filter(Boolean);
};
```

### Task 5.2: Filtered View Atom

**Create derived atom for filtered MRs:**

```typescript
// src/store/filterAtoms.ts

// Current active user selection
export const activeUserSelectionAtom = atom<number>(0);

// Derived: current selection entry
export const currentSelectionEntryAtom = atom(get => {
  const selectionIndex = get(activeUserSelectionAtom);
  return userSelectionEntries[selectionIndex];
});

// Derived: filter predicate for current selection
export const filterPredicateAtom = atom(get => {
  const selection = get(currentSelectionEntryAtom);
  return buildFilterPredicate(selection);
});

// Derived: filtered MRs
export const filteredMRsAtom = atom(get => {
  const allMRs = get(projectedMRsArrayAtom);
  const predicate = get(filterPredicateAtom);

  return allMRs.filter(predicate);
});

// Derived: filtered MR count
export const filteredMRCountAtom = atom(get => {
  return get(filteredMRsAtom).length;
});
```

**UI consumption:**

```typescript
// In MR list component
const mrs = useAtomValue(filteredMRsAtom);  // Only filtered MRs
const count = useAtomValue(filteredMRCountAtom);

// mrs now contains only MRs matching current selection
```

### Task 5.3: Update User Selection Switching

**Remove fetch logic, make instant:**

```typescript
// src/store/userSelectionEffects.ts (refactor)

// OLD: Triggered fetch + clear-delay-set
export const switchUserSelection_OLD = (index: number): Effect<void> => {
  return Effect.gen(function* (_) {
    // Clear state (needed to prevent crashes)
    set({ mergeRequests: [], branchDifferences: new Map() });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set new selection
    set({ selectedUserSelectionEntry: index });

    // Fetch MRs for new selection
    yield* _(fetchMergeRequests());
  });
};

// NEW: Just update filter (instant)
export const switchUserSelection = (index: number): Effect<void> => {
  return Effect.sync(() => {
    activeUserSelectionAtom.set(index);
    // That's it! Filtering happens automatically via derived atoms
  });
};
```

**Benefits:**
- ✅ No more clear-delay-set hack
- ✅ Instant switching (<1ms)
- ✅ No API calls
- ✅ No crashes from rapid updates

### Task 5.4: Multi-Filter Support (Optional)

**Allow combining multiple filters:**

```typescript
// src/filtering/multiFilter.ts

type FilterCriteria = {
  userSelectionIndex?: number
  states?: MergeRequestState[]       // opened, merged, closed
  hasJiraTicket?: boolean
  searchText?: string
  dateRange?: { from: Date, to: Date }
};

export const buildMultiFilterPredicate = (
  criteria: FilterCriteria
): FilterPredicate => {
  const predicates: FilterPredicate[] = [];

  // User selection filter
  if (criteria.userSelectionIndex !== undefined) {
    const selection = userSelectionEntries[criteria.userSelectionIndex];
    predicates.push(buildFilterPredicate(selection));
  }

  // State filter
  if (criteria.states && criteria.states.length > 0) {
    predicates.push(mr => criteria.states!.includes(mr.state));
  }

  // Jira filter
  if (criteria.hasJiraTicket !== undefined) {
    predicates.push(mr => {
      const hasTicket = mr.jiraIssueKeys.length > 0;
      return hasTicket === criteria.hasJiraTicket;
    });
  }

  // Text search
  if (criteria.searchText) {
    const search = criteria.searchText.toLowerCase();
    predicates.push(mr =>
      mr.title.toLowerCase().includes(search) ||
      mr.author.username.toLowerCase().includes(search)
    );
  }

  // Date range
  if (criteria.dateRange) {
    predicates.push(mr => {
      const updated = new Date(mr.updatedAt);
      return updated >= criteria.dateRange!.from && updated <= criteria.dateRange!.to;
    });
  }

  // Combine with AND (all must match)
  return (mr: MergeRequest) => {
    return predicates.every(predicate => predicate(mr));
  };
};
```

**Advanced filtering atom:**

```typescript
// src/store/filterAtoms.ts (extend)

export const filterCriteriaAtom = atom<FilterCriteria>({
  userSelectionIndex: 0
});

export const advancedFilteredMRsAtom = atom(get => {
  const allMRs = get(projectedMRsArrayAtom);
  const criteria = get(filterCriteriaAtom);
  const predicate = buildMultiFilterPredicate(criteria);

  return allMRs.filter(predicate);
});
```

## Backward Compatibility

**Keep existing user selection structure:**

```typescript
// src/data/usersAndGroups.ts (no changes needed)

// Existing selections work as-is:
export const userSelectionEntries: UserSelectionEntry[] = [
  {
    name: 'r.schoorstra',
    selection: [{ type: 'userId', id: 'r.schoorstra' }]
  },
  {
    name: 'florence BE',
    selection: [{ type: 'groupId', id: 'florenceBE' }]
  },
  // ... etc
];

// These now define filters, not fetches
```

**UI changes minimal:**
- User selection dropdown stays same
- Switching behavior feels same (but faster!)
- MR list updates same way (via atom)

## Files to Create/Modify

### New Files
- `src/filtering/filterBuilder.ts` - Filter predicate builder
- `src/filtering/multiFilter.ts` - Advanced filtering (optional)
- `src/store/filterAtoms.ts` - Filter state atoms

### Files to Modify
- `src/store/userSelectionEffects.ts` - Remove fetch logic
- `src/store/appAtoms.ts` - Replace MR atoms with filtered atoms
- UI components - Use `filteredMRsAtom` instead of `mergeRequestsAtom`

### Files to Remove (Later)
- `src/mergerequests/mergerequests-caching-effects.ts` - Old cache logic

## UI Integration

**Replace MR atom references:**

```typescript
// OLD: Direct MR state
const mrs = useAtomValue(mergeRequestsAtom);

// NEW: Filtered view
const mrs = useAtomValue(filteredMRsAtom);
```

**All existing UI components work with filtered data:**
- MR list renders filtered MRs
- Selected MR index still works
- Keyboard navigation unchanged
- Count reflects filtered count

## Performance Considerations

### Filter Performance
- Filtering 150 MRs: <1ms
- No perceptible delay
- Could memoize predicate if needed

### Memory
- Filtered array is derived (not duplicated)
- Only references to MRs, not copies
- Negligible memory overhead

### Reactivity
- Atom updates trigger re-render automatically
- Efficient with Jotai's dependency tracking
- No manual subscriptions needed

## Success Criteria

- ✅ User selections filter projected MRs correctly
- ✅ Selection switching is instant (no fetch)
- ✅ No more clear-delay-set pattern needed
- ✅ Groups expand to users correctly
- ✅ Repository selections filter by repo
- ✅ UI updates correctly with filtered data
- ✅ Performance: filtering <1ms for typical dataset

## Testing Strategy

### Unit Tests
- Filter predicate building for each selection type
- Group expansion logic
- Multi-filter combination

### Integration Tests
- Switch selections, verify filtered results
- Combine user + repo filters
- Edge cases: empty selection, no matches

### UI Tests
- Switch selections, verify MR list updates
- Check MR count matches filter
- Verify keyboard navigation still works

## Migration Notes

**Gradual rollout:**
1. Add filtering alongside old fetch logic
2. Switch UI to use filtered atoms
3. Verify behavior identical
4. Remove old fetch logic
5. Remove clear-delay-set pattern

**Rollback:**
- Keep old atoms temporarily
- Can switch back if issues
- Full removal after validation

## Next Phase Dependencies

Phase 6 (Time-Travel) will:
- Use same filtering logic on historical projections
- Show filtered view at any point in time
- Compare filters across time periods
