# Phase 4: Multi-Strategy Sync Implementation

## Goal
Implement repository, user, and single-MR sync strategies that all append to the event stream.

## Dependencies
- Phase 1 complete (event storage and appenders)
- Phase 3 complete (projection engine)
- Phase 2 for parsing (completed in Phase 3)

## Tasks

### Task 4.1: Repository Sync

**Sync all MRs from a repository:**

```typescript
// src/sync/repositorySync.ts

export const syncRepository = (repoId: string): Effect<number> => {
  return Effect.gen(function* (_) {
    try {
      // 1. Fetch from API (use existing fetchMergeRequestsByProject)
      const rawResponse = yield* _(fetchRepositoryMRsRaw(repoId));

      // 2. Append event with raw response
      const eventId = yield* _(appendRepoFetchEvent(repoId, rawResponse));

      // 3. Projection updates automatically in appender
      yield* _(Effect.logInfo(`Synced repository ${repoId} (event ${eventId})`));

      return eventId;
    } catch (error) {
      yield* _(Effect.logError(`Failed to sync repository ${repoId}`, error));
      throw error;
    }
  });
};

// Fetch raw response (modify existing functions to return raw)
const fetchRepositoryMRsRaw = (repoId: string): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const { provider, projectPath } = parseRepositoryId(repoId);

    if (provider === 'gitlab') {
      return yield* _(getGitlabMrsByProjectRaw(projectPath));
    } else if (provider === 'bitbucket') {
      return yield* _(getBitbucketPrsRaw(projectPath));
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  });
};
```

**Modify existing fetch functions to return raw:**

```typescript
// src/gitlab/gitlabgraphql.ts (modify)

export const getGitlabMrsByProjectRaw = (
  projectPath: string
): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const query = `
      query GetProjectMRs($projectPath: ID!) {
        project(fullPath: $projectPath) {
          mergeRequests(state: opened, first: 25) {
            nodes {
              # ... all fields
            }
          }
        }
      }
    `;

    const variables = { projectPath };
    const rawResponse = yield* _(executeGraphQLQuery(query, variables));

    // Return raw response (don't normalize here)
    return rawResponse;
  });
};

// src/bitbucket/bitbucketapi.ts (modify)

export const getBitbucketPrsRaw = (
  repoPath: string
): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const [workspace, repoSlug] = repoPath.split('/');
    const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests`;

    const rawResponse = yield* _(fetchJSON(url));

    // Return raw response
    return rawResponse;
  });
};
```

### Task 4.2: User Sync

**Sync all MRs by author:**

```typescript
// src/sync/userSync.ts

export const syncUser = (username: string): Effect<number> => {
  return Effect.gen(function* (_) {
    try {
      // 1. Fetch from GitLab API (user-based query)
      const rawResponse = yield* _(getGitlabMrsByUserRaw(username));

      // 2. Append event with raw response
      const eventId = yield* _(appendUserFetchEvent(username, rawResponse));

      yield* _(Effect.logInfo(`Synced user ${username} (event ${eventId})`));

      return eventId;
    } catch (error) {
      yield* _(Effect.logError(`Failed to sync user ${username}`, error));
      throw error;
    }
  });
};

// Fetch user MRs raw (modify existing)
const getGitlabMrsByUserRaw = (username: string): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const query = `
      query GetUserMRs($username: String!) {
        mergeRequests(authorUsername: $username, state: opened, first: 10) {
          nodes {
            # ... all fields
          }
        }
      }
    `;

    const variables = { username };
    const rawResponse = yield* _(executeGraphQLQuery(query, variables));

    return rawResponse;
  });
};
```

**Note:** Bitbucket doesn't support user-based queries, only repo-based.

### Task 4.3: Single MR Refresh

**Refresh individual MR:**

```typescript
// src/sync/singleMRSync.ts

export const syncSingleMR = (mrId: MRId): Effect<number> => {
  return Effect.gen(function* (_) {
    const { provider, projectPath, mrNumber } = parseMRId(mrId);

    try {
      // 1. Fetch single MR from API
      const rawResponse = yield* _(fetchSingleMRRaw(provider, projectPath, mrNumber));

      // 2. Append event
      const eventId = yield* _(appendSingleMRFetchEvent(mrId, rawResponse));

      yield* _(Effect.logInfo(`Synced MR ${mrId} (event ${eventId})`));

      return eventId;
    } catch (error) {
      yield* _(Effect.logError(`Failed to sync MR ${mrId}`, error));
      throw error;
    }
  });
};

// Fetch single MR (create new API calls)
const fetchSingleMRRaw = (
  provider: 'gitlab' | 'bitbucket',
  projectPath: string,
  mrNumber: number
): Effect<unknown> => {
  if (provider === 'gitlab') {
    return fetchGitLabSingleMRRaw(projectPath, mrNumber);
  } else {
    return fetchBitbucketSinglePRRaw(projectPath, mrNumber);
  }
};

// GitLab REST API for single MR
const fetchGitLabSingleMRRaw = (
  projectPath: string,
  mrNumber: number
): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const encodedPath = encodeURIComponent(projectPath);
    const url = `${GITLAB_API_BASE}/projects/${encodedPath}/merge_requests/${mrNumber}`;

    const rawResponse = yield* _(fetchJSON(url, {
      headers: { 'PRIVATE-TOKEN': gitlabToken }
    }));

    return rawResponse;
  });
};

// Bitbucket REST API for single PR
const fetchBitbucketSinglePRRaw = (
  repoPath: string,
  prNumber: number
): Effect<unknown> => {
  return Effect.gen(function* (_) {
    const [workspace, repoSlug] = repoPath.split('/');
    const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`;

    const rawResponse = yield* _(fetchJSON(url, {
      auth: { username: bitbucketEmail, password: bitbucketToken }
    }));

    return rawResponse;
  });
};
```

### Task 4.4: Sync Orchestration

**Coordinate multiple syncs:**

```typescript
// src/sync/syncOrchestrator.ts

// Sync all configured repositories
export const syncConfiguredRepos = (): Effect<number[]> => {
  return Effect.gen(function* (_) {
    const settings = yield* _(loadSettings());
    const repoIds = settings.syncedRepositories || [];

    yield* _(Effect.logInfo(`Syncing ${repoIds.length} repositories...`));

    // Sync in parallel
    const eventIds = yield* _(
      Effect.all(
        repoIds.map(repoId => syncRepository(repoId)),
        { concurrency: 5 } // Limit concurrent API calls
      )
    );

    yield* _(Effect.logInfo(`Synced ${eventIds.length} repositories`));

    return eventIds;
  });
};

// Sync multiple users (if needed)
export const syncConfiguredUsers = (): Effect<number[]> => {
  return Effect.gen(function* (_) {
    const settings = yield* _(loadSettings());
    const usernames = settings.syncedUsers || [];

    if (usernames.length === 0) return [];

    yield* _(Effect.logInfo(`Syncing ${usernames.length} users...`));

    const eventIds = yield* _(
      Effect.all(
        usernames.map(username => syncUser(username)),
        { concurrency: 3 }
      )
    );

    return eventIds;
  });
};

// Full sync (repos + users)
export const syncAll = (): Effect<void> => {
  return Effect.gen(function* (_) {
    yield* _(setSyncInProgress(true));

    try {
      // Sync repos and users in parallel
      yield* _(Effect.all([
        syncConfiguredRepos(),
        syncConfiguredUsers()
      ]));

      yield* _(Effect.logInfo('Full sync completed'));
    } finally {
      yield* _(setSyncInProgress(false));
    }
  });
};
```

**Sync state atom:**

```typescript
// src/store/syncAtoms.ts

export const syncInProgressAtom = atom<boolean>(false);

export const lastSyncTimestampAtom = atom<Date | null>(null);

export const setSyncInProgress = (inProgress: boolean): Effect<void> => {
  return Effect.sync(() => {
    syncInProgressAtom.set(inProgress);
    if (!inProgress) {
      lastSyncTimestampAtom.set(new Date());
    }
  });
};
```

## Repository Configuration

**Settings for sync:**

```typescript
// src/settings/settings.ts (extend)

type Settings = {
  // ... existing settings
  syncedRepositories: string[]  // ["gitlab:elab/elab", "bitbucket:raftdev/core.iam"]
  syncedUsers: string[]         // ["r.schoorstra", "MennoGerbens"] (optional)
};

// Default repos based on current userselections
const defaultSyncedRepos = [
  'gitlab:elab/elab',
  'gitlab:elab/BlackLotus',
  'gitlab:elab/db-splitter',
  'bitbucket:raftdev/core.iam'
];
```

## Files to Create/Modify

### New Files
- `src/sync/repositorySync.ts` - Repository sync
- `src/sync/userSync.ts` - User sync
- `src/sync/singleMRSync.ts` - Single MR refresh
- `src/sync/syncOrchestrator.ts` - Multi-sync coordination
- `src/store/syncAtoms.ts` - Sync state management

### Files to Modify
- `src/gitlab/gitlabgraphql.ts` - Add raw response variants
- `src/bitbucket/bitbucketapi.ts` - Add raw response variants
- `src/settings/settings.ts` - Add sync configuration

### Files to Remove (Later)
- Old fetch orchestration in `mergerequests-effects.ts`

## User Actions

**Trigger syncs from UI:**

```typescript
// Manual refresh action (existing key binding)
onRefresh: () => {
  Effect.runPromise(syncAll());
}

// Refresh single MR (new action)
onRefreshMR: (mrId: MRId) => {
  Effect.runPromise(syncSingleMR(mrId));
}
```

## Success Criteria

- ✅ Repository sync appends repo fetch events
- ✅ User sync appends user fetch events
- ✅ Single MR refresh appends single-mr events
- ✅ All sync types trigger projection update
- ✅ Parallel syncs work (multiple repos at once)
- ✅ Sync progress visible in UI
- ✅ Failed syncs logged but don't crash app
- ✅ Settings store configured repos/users

## Error Handling

### API Failures
- Log error with context (repo/user)
- Don't append event if fetch fails
- Continue syncing other repos/users
- Show error toast to user

### Rate Limiting
- Implement exponential backoff
- Respect API rate limits
- Show warning if rate limited

### Network Errors
- Retry with timeout
- Fall back to cached projection
- Show offline indicator

## Performance Considerations

### Parallel Fetching
- Sync multiple repos concurrently (limit: 5)
- Avoid overwhelming APIs
- Balance speed vs. rate limits

### Event Append Batching
- Each sync = 1 event append
- Projection debounced (updates once after all syncs)
- UI doesn't block during sync

### Incremental Updates
- Only append new events (don't re-fetch if recent)
- Could add TTL to skip sync if recent event exists

## Next Phase Dependencies

Phase 5 (Filtering) will:
- Consume projected MRs from Phase 3
- Filter by user selection criteria
- No fetching required (instant)
