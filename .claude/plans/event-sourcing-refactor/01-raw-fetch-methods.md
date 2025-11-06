# Phase 1: Raw Fetch Methods & Response Types

## Goal
Create fetch functions that return **raw, unprocessed API responses** and define **precise TypeScript types** for each response structure. These types will be used in event storage.

## Why This Phase Must Come First

**Critical Dependency:** Event storage needs to know the exact structure of API responses.

1. **Type Precision:** We can only define event schemas after we know response types
2. **Event Sourcing Principle:** Store facts (raw responses), not interpretations (normalized data)
3. **Future-Proof:** If we change normalization logic, we can replay events with new logic
4. **Type Safety:** TypeScript types from responses ensure compile-time safety in event storage

## Dependencies
None - this is the foundational phase

## Current State Analysis

### Existing Fetch Functions (Process Too Much)

**Problem:** Current functions normalize responses immediately, discarding raw data.

```typescript
// ❌ Current: getGitlabMrs() returns normalized GitlabMergeRequest[]
export const getGitlabMrs = (usernames: string[], state) => {
  const data = await sdk.MRs({ usernames, state });
  // Immediately maps/normalizes, loses raw response structure
  return data.users.nodes.flatMap(user =>
    user.authoredMergeRequests.nodes.map(mr => mapMrFromQuery(user.username, mr))
  );
};
```

**What We Need:**
```typescript
// ✅ New: getGitlabMrsRaw() returns raw GraphQL response
export const getGitlabMrsRaw = (usernames: string[], state): MRsQuery => {
  const data = await sdk.MRs({ usernames, state });
  return data; // Return raw response, no processing
};
```

## Tasks

### Task 1.1: Define Raw Response Types

**Create TypeScript types for each API response.**

#### GitLab GraphQL Response Types

These are already generated in `src/generated/gitlab-sdk.ts` from GraphQL Code Generator:

```typescript
// Available from generated SDK:
import type { MRsQuery, ProjectMRsQuery, MRPipelineQuery } from '../generated/gitlab-sdk';
```

**No additional type definitions needed** - we'll use the generated types directly.

#### Bitbucket REST Response Types

These are manually defined in `src/bitbucket/bitbucketapi.ts`:

```typescript
// Already defined:
export interface BitbucketPullRequestsResponse { ... }
export interface BitbucketCommentsResponse { ... }
```

**But we need a combined type for event storage:**

```typescript
// src/bitbucket/types.ts (new file)

import type {
  BitbucketPullRequestsResponse,
  BitbucketCommentsResponse
} from './bitbucketapi';

/**
 * Combined Bitbucket fetch response
 * Includes both PRs and all their comments fetched in parallel
 */
export type BitbucketRepoFetchResponse = {
  prs: BitbucketPullRequestsResponse;
  commentsByPrId: Record<number, BitbucketCommentsResponse>;
};
```

### Task 1.2: Create Raw Fetch Functions

**Create new functions that return raw responses without normalization.**

#### File Structure

```
src/fetch/
  ├── gitlab-raw.ts       # GitLab raw fetch functions
  ├── bitbucket-raw.ts    # Bitbucket raw fetch functions
  └── types.ts            # Union type for all raw responses
```

#### GitLab Raw Fetches

```typescript
// src/fetch/gitlab-raw.ts

import { Effect, Console } from "effect";
import { GraphQLClient } from "graphql-request";
import { getSdk, type MRsQuery, type ProjectMRsQuery, type MergeRequestState } from "../generated/gitlab-sdk";

/**
 * Fetch MRs by user (raw GraphQL response)
 * Returns: MRsQuery (generated type)
 */
export const getGitlabMrsRaw = Effect.fn("getGitlabMrsRaw")(
  function* (usernames: string[], state: MergeRequestState = 'opened') {
    const endpoint = `https://git.elabnext.com/api/graphql`;
    const token = process.env.GITLAB_TOKEN;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sdk = getSdk(client);

    yield* Console.log(`[GitLab] Fetching MRs for users: ${usernames.join(', ')}, state: ${state}`);

    const data: MRsQuery = yield* Effect.tryPromise({
      try: () => sdk.MRs({
        usernames: usernames,
        state: state,
        first: 7
      }),
      catch: cause => new Error(`Failed to fetch GitLab MRs: ${cause}`)
    });

    yield* Console.log(`[GitLab] Fetched raw response: ${data.users?.nodes?.length || 0} users`);

    // Return raw response, NO normalization
    return data;
  }
);

/**
 * Fetch MRs by project (raw GraphQL response)
 * Returns: ProjectMRsQuery (generated type)
 */
export const getGitlabMrsByProjectRaw = Effect.fn("getGitlabMrsByProjectRaw")(
  function* (projectPath: string, state: MergeRequestState = 'opened') {
    const endpoint = `https://git.elabnext.com/api/graphql`;
    const token = process.env.GITLAB_TOKEN;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sdk = getSdk(client);

    yield* Console.log(`[GitLab] Fetching project MRs: ${projectPath}, state: ${state}`);

    const data: ProjectMRsQuery = yield* Effect.tryPromise({
      try: () => sdk.ProjectMRs({
        projectPath: projectPath,
        state: state,
        first: 25
      }),
      catch: cause => new Error(`Failed to fetch GitLab project MRs: ${cause}`)
    });

    yield* Console.log(`[GitLab] Fetched raw response: ${data.project?.mergeRequests?.nodes?.length || 0} MRs`);

    // Return raw response, NO normalization
    return data;
  }
);
```

#### Bitbucket Raw Fetches

```typescript
// src/fetch/bitbucket-raw.ts

import { Effect, Console } from "effect";
import type {
  BitbucketPullRequestsResponse,
  BitbucketCommentsResponse
} from "../bitbucket/bitbucketapi";

/**
 * Combined Bitbucket response (PRs + all comments)
 */
export type BitbucketRepoFetchResponse = {
  prs: BitbucketPullRequestsResponse;
  commentsByPrId: Record<number, BitbucketCommentsResponse>;
};

/**
 * Fetch single PR's comments (raw)
 */
const fetchPRCommentsRaw = Effect.fn("fetchPRCommentsRaw")(
  function* (workspace: string, repoSlug: string, prId: number, authToken: string) {
    const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

    const response = yield* Effect.tryPromise({
      try: () => fetch(url, {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/json',
        }
      }),
      catch: cause => new Error(`Failed to fetch Bitbucket comments: ${cause}`)
    });

    if (!response.ok) {
      yield* Console.error(`[Bitbucket] Failed to fetch comments for PR ${prId}: ${response.status}`);
      return { values: [] } as BitbucketCommentsResponse;
    }

    const data: BitbucketCommentsResponse = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: cause => new Error(`Failed to parse Bitbucket comments JSON: ${cause}`)
    });

    return data;
  }
);

/**
 * Fetch PRs and all comments (raw, combined response)
 * Returns: BitbucketRepoFetchResponse
 */
export const getBitbucketPrsRaw = Effect.fn("getBitbucketPrsRaw")(
  function* (
    workspace: string,
    repoSlug: string,
    state: 'opened' | 'merged' | 'closed' | 'all' | 'locked' = 'opened'
  ) {
    if (!(process.env.BITBUCKET_EMAIL && process.env.BITBUCKET_API_TOKEN)) {
      return yield* Effect.fail(new Error("Bitbucket credentials not configured"));
    }

    const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
    const authToken = Buffer.from(credentials).toString("base64");

    // Map state to Bitbucket API format
    const bbState = mapStateToBitbucket(state);
    const url = bbState === 'ALL'
      ? `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?pagelen=50`
      : `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=${bbState}&pagelen=50`;

    yield* Console.log(`[Bitbucket] Fetching PRs: ${workspace}/${repoSlug}, state: ${bbState}`);

    // Fetch PRs
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/json',
        }
      }),
      catch: cause => new Error(`Failed to fetch Bitbucket PRs: ${cause}`)
    });

    if (!response.ok) {
      return yield* Effect.fail(new Error(`Bitbucket API error: ${response.status}`));
    }

    const prsResponse: BitbucketPullRequestsResponse = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: cause => new Error(`Failed to parse Bitbucket PRs JSON: ${cause}`)
    });

    yield* Console.log(`[Bitbucket] Fetched ${prsResponse.values.length} PRs, fetching comments...`);

    // Fetch comments for all PRs in parallel
    const commentResults = yield* Effect.forEach(
      prsResponse.values,
      (pr) => Effect.gen(function* () {
        const comments = yield* fetchPRCommentsRaw(workspace, repoSlug, pr.id, authToken).pipe(
          Effect.catchAll(() => Effect.succeed({ values: [] } as BitbucketCommentsResponse))
        );
        return { prId: pr.id, comments };
      }),
      { concurrency: "unbounded" }
    );

    // Build comments map
    const commentsByPrId: Record<number, BitbucketCommentsResponse> = {};
    commentResults.forEach(({ prId, comments }) => {
      commentsByPrId[prId] = comments;
    });

    yield* Console.log(`[Bitbucket] Fetched comments for ${commentResults.length} PRs`);

    // Return combined raw response
    return {
      prs: prsResponse,
      commentsByPrId
    } satisfies BitbucketRepoFetchResponse;
  }
);

function mapStateToBitbucket(state: 'opened' | 'merged' | 'closed' | 'all' | 'locked'): string {
  switch (state) {
    case 'opened': return 'OPEN';
    case 'merged': return 'MERGED';
    case 'closed': return 'DECLINED';
    case 'all': return 'ALL';
    case 'locked': return 'ALL';
    default: return 'OPEN';
  }
}
```

### Task 1.3: Define Union Type for All Raw Responses

```typescript
// src/fetch/types.ts

import type { MRsQuery, ProjectMRsQuery } from '../generated/gitlab-sdk';
import type { BitbucketRepoFetchResponse } from './bitbucket-raw';

/**
 * Union of all possible raw fetch responses
 * Used in event storage to type rawResponse field
 */
export type RawFetchResponse =
  | MRsQuery                        // GitLab user-based fetch
  | ProjectMRsQuery                 // GitLab project-based fetch
  | BitbucketRepoFetchResponse;     // Bitbucket repo fetch (PRs + comments)

/**
 * Type guard to check if response is GitLab user query
 */
export function isMRsQuery(response: RawFetchResponse): response is MRsQuery {
  return 'users' in response && response.users !== undefined;
}

/**
 * Type guard to check if response is GitLab project query
 */
export function isProjectMRsQuery(response: RawFetchResponse): response is ProjectMRsQuery {
  return 'project' in response && response.project !== undefined;
}

/**
 * Type guard to check if response is Bitbucket
 */
export function isBitbucketResponse(response: RawFetchResponse): response is BitbucketRepoFetchResponse {
  return 'prs' in response && 'commentsByPrId' in response;
}
```

### Task 1.4: Export Raw Fetch Functions

```typescript
// src/fetch/index.ts

export * from './gitlab-raw';
export * from './bitbucket-raw';
export * from './types';
```

## Files to Create

### New Files
- `src/fetch/gitlab-raw.ts` - GitLab raw fetch functions
- `src/fetch/bitbucket-raw.ts` - Bitbucket raw fetch functions
- `src/fetch/types.ts` - Union type and type guards
- `src/fetch/index.ts` - Barrel export

### Files to Reference
- `src/generated/gitlab-sdk.ts` - Use generated types
- `src/bitbucket/bitbucketapi.ts` - Use existing Bitbucket types
- `src/gitlab/gitlabgraphql.ts` - Reference existing logic (don't modify yet)

## Success Criteria

- ✅ Raw fetch functions return unprocessed API responses
- ✅ All responses have precise TypeScript types
- ✅ Union type `RawFetchResponse` covers all cases
- ✅ Type guards enable runtime type discrimination
- ✅ No normalization happens in fetch functions
- ✅ Functions log what they're fetching (debugging)
- ✅ All functions use Effect for error handling
- ✅ Type check passes with no errors

## Testing Strategy

### Manual Testing
```typescript
// Test raw GitLab user fetch
const rawMRs = yield* getGitlabMrsRaw(['r.schoorstra'], 'opened');
console.log(rawMRs.users?.nodes?.[0]?.authoredMergeRequests?.nodes?.[0]);
// Should see raw GraphQL structure, not normalized MR

// Test raw GitLab project fetch
const rawProject = yield* getGitlabMrsByProjectRaw('elab/elab', 'opened');
console.log(rawProject.project?.mergeRequests?.nodes?.[0]);
// Should see raw GraphQL structure

// Test raw Bitbucket fetch
const rawBB = yield* getBitbucketPrsRaw('raftdev', 'core.iam', 'opened');
console.log(rawBB.prs.values[0]);
console.log(rawBB.commentsByPrId[rawBB.prs.values[0].id]);
// Should see raw REST response + comments
```

### Type Validation
```typescript
// Verify types are correctly inferred
import type { RawFetchResponse } from '../fetch/types';

const response: RawFetchResponse = yield* getGitlabMrsRaw(...);
if (isMRsQuery(response)) {
  // TypeScript knows: response is MRsQuery
  const users = response.users?.nodes;
}
```

## Performance Considerations

- Raw responses are the same size as current fetches (no extra cost)
- Bitbucket still fetches comments in parallel (same as current)
- No additional API calls - just returning raw data instead of processing

## Next Phase Dependencies

Phase 2 (Event Stream Storage) will:
- Import `RawFetchResponse` type for event schema
- Use type guards to validate responses before storage
- Store raw responses in events without processing
