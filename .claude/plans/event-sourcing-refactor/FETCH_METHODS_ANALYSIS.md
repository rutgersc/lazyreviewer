# Fetch Methods Analysis

## Overview

This document analyzes all existing fetch methods in LazyGitLab to understand what raw responses we need to store in the event stream.

## Current Fetch Methods

### 1. GitLab User-Based Fetch (User MRs)

**Function:** `getGitlabMrs(usernames: string[], state: MergeRequestState)`

**Location:** `src/gitlab/gitlabgraphql.ts:143`

**GraphQL Query:** `src/graphql/mrs.graphql`

**Query Structure:**
```graphql
query MRs($usernames: [String!], $state: MergeRequestState, $first: Int!) {
  users(usernames: $usernames, first: $first) {
    nodes {
      username
      authoredMergeRequests(state: $state, first: 10) {
        nodes {
          id, iid, name, webUrl
          sourceBranch, targetBranch
          project { name, path, fullPath }
          author { name, avatarUrl }
          createdAt, updatedAt, state
          approvedBy { nodes { id, name, username } }
          discussions { nodes { ... } }
          headPipeline { stages { nodes { ... } } }
        }
      }
    }
  }
}
```

**Parameters:**
- `usernames: string[]` - List of GitLab usernames
- `state: MergeRequestState` - 'opened', 'merged', 'closed'
- `first: 7` - Hardcoded limit for user query

**Response Type:** `MRsQuery` (from generated SDK)

**Response Structure:**
```typescript
{
  users: {
    nodes: [
      {
        username: string
        authoredMergeRequests: {
          nodes: [GitLabMergeRequest]
        }
      }
    ]
  }
}
```

**Current Processing:**
1. Flattens `users.nodes[].authoredMergeRequests.nodes[]`
2. Slices to 15 MRs per user
3. Maps via `mapMrFromQuery()` to normalized `GitlabMergeRequest`

**Debug Output:** `debug/gitlab-response-debug.json`

---

### 2. GitLab Project-Based Fetch (Repository MRs)

**Function:** `getGitlabMrsByProject(projectPath: string, state: MergeRequestState)`

**Location:** `src/gitlab/gitlabgraphql.ts:192`

**GraphQL Query:** `src/graphql/project-mrs.graphql`

**Query Structure:**
```graphql
query ProjectMRs($projectPath: ID!, $state: MergeRequestState, $first: Int!) {
  project(fullPath: $projectPath) {
    id, name, path, fullPath
    mergeRequests(state: $state, first: $first, sort: UPDATED_DESC) {
      nodes {
        id, iid, title, webUrl
        sourceBranch, targetBranch
        project { name, path, fullPath }
        author { name, username, avatarUrl }
        createdAt, updatedAt, state
        approvedBy { nodes { id, name, username } }
        discussions { nodes { ... } }
        headPipeline { stages { nodes { ... } } }
      }
    }
  }
}
```

**Parameters:**
- `projectPath: string` - Full project path (e.g., "elab/elab")
- `state: MergeRequestState` - 'opened', 'merged', 'closed'
- `first: 25` - Limit for project query

**Response Type:** `ProjectMRsQuery` (from generated SDK)

**Response Structure:**
```typescript
{
  project: {
    id: string
    name: string
    path: string
    fullPath: string
    mergeRequests: {
      nodes: [GitLabMergeRequest]
    }
  }
}
```

**Current Processing:**
1. Extracts `project.mergeRequests.nodes[]`
2. Maps via `mapProjectMr()` to normalized `GitlabMergeRequest`

**Debug Output:** `debug/gitlab-project-response-debug.json`

**Key Difference from User Query:**
- Note field name: `title` (project) vs `name` (user)
- Author includes `username` field (project) vs just passed as parameter (user)

---

### 3. GitLab Single MR Pipeline Fetch

**Function:** `getMrPipeline(projectPath: string, iid: string)`

**Location:** `src/gitlab/gitlabgraphql.ts:337`

**GraphQL Query:** `src/graphql/mr-pipeline.graphql`

**Query Structure:**
```graphql
query MRPipeline($projectPath: ID!, $iid: String!) {
  project(fullPath: $projectPath) {
    mergeRequest(iid: $iid) {
      id
      iid
      headPipeline {
        active
        iid
        stages {
          nodes {
            id, name, status
            jobs {
              nodes {
                id, webPath, name, status
                failureMessage, startedAt, duration
              }
            }
          }
        }
      }
    }
  }
}
```

**Parameters:**
- `projectPath: string` - Full project path
- `iid: string` - MR internal ID

**Response Type:** MRPipeline query response

**Response Structure:**
```typescript
{
  project: {
    mergeRequest: {
      id: string
      iid: string
      headPipeline: {
        stages: {
          nodes: [PipelineStage]
        }
      }
    }
  }
}
```

**Current Processing:**
1. Extracts `project.mergeRequest.headPipeline`
2. Returns only pipeline data (not full MR)

**Use Case:** Refresh pipeline for a single MR without re-fetching entire MR

**Note:** This is a **partial update** - only pipeline data, not full MR

---

### 4. Bitbucket Repository-Based Fetch

**Function:** `getBitbucketPrs(workspace: string, repoSlug: string, state: 'opened' | 'merged' | 'closed' | 'all' | 'locked')`

**Location:** `src/bitbucket/bitbucketapi.ts:264`

**API:** Bitbucket REST API v2.0

**Endpoint:**
```
GET https://api.bitbucket.org/2.0/repositories/{workspace}/{repoSlug}/pullrequests
  ?state={state}
  &pagelen=50
```

**Authentication:** Basic Auth (email:token base64-encoded)

**Parameters:**
- `workspace: string` - Bitbucket workspace
- `repoSlug: string` - Repository slug
- `state: string` - Mapped to BB states (OPEN, MERGED, DECLINED, ALL)

**Response Type:** `BitbucketPullRequestsResponse`

**Response Structure:**
```typescript
{
  values: [
    {
      id: number
      title: string
      description?: string
      state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED"
      author: BitbucketAccount
      source: { branch, commit, repository }
      destination: { branch, commit, repository }
      participants: BitbucketParticipant[]
      reviewers: BitbucketAccount[]
      created_on: string
      updated_on: string
      comment_count?: number
      task_count?: number
      links: { html: { href }, self: { href } }
    }
  ],
  page?: number,
  pagelen?: number,
  size?: number,
  next?: string
}
```

**Additional Fetching:**
After fetching PRs, **fetches comments for each PR in parallel**:

**Comment Endpoint:**
```
GET https://api.bitbucket.org/2.0/repositories/{workspace}/{repoSlug}/pullrequests/{prId}/comments
```

**Comment Response Type:** `BitbucketCommentsResponse`

**Comment Response Structure:**
```typescript
{
  values: [
    {
      id: number
      created_on: string
      updated_on: string
      content: { raw: string, markup?: string, html?: string }
      user: BitbucketAccount
      deleted?: boolean
      parent?: { id: number }
      inline?: { from?: number, to?: number, path: string }
      links: { self, html }
      pullrequest?: { type, id }
      resolution?: BitbucketCommentResolution | null
    }
  ]
}
```

**Current Processing:**
1. Fetches all PRs for repository
2. Fetches comments for ALL PRs in parallel (unbounded concurrency!)
3. Maps comments to discussions
4. Maps BitbucketPullRequest → GitlabMergeRequest via `mapBitbucketToGitlabMergeRequest()`

**Debug Output:** `debug/bitbucket-response-debug.json`

**Note:** Bitbucket does NOT support user-based queries - only repository-based

---

## Response Structure Comparison

### Common Fields Across All Methods

After normalization to `GitlabMergeRequest`:

```typescript
{
  id: string
  iid: number | string
  title: string
  jiraIssueKeys: string[]
  webUrl: string
  sourcebranch: string
  targetbranch: string
  project: {
    name: string
    path: string
    fullPath: string
  }
  author: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
  state: string
  approvedBy: Array<{ id: string, name: string, username: string }>
  resolvableDiscussions: number
  resolvedDiscussions: number
  unresolvedDiscussions: number
  totalDiscussions: number
  discussions: Discussion[]
  pipeline: {
    stage: PipelineStage[]
  }
}
```

### Differences in Raw Responses

**GitLab User Query:**
- Nested under `users.nodes[].authoredMergeRequests.nodes[]`
- Field name: `mr.name` (not `title`)
- Author username passed separately (not in response)
- Response type: `MRsQuery`

**GitLab Project Query:**
- Nested under `project.mergeRequests.nodes[]`
- Field name: `mr.title`
- Author includes `username` in response
- Response type: `ProjectMRsQuery`

**Bitbucket REST:**
- Flat array: `values[]`
- Different field names (snake_case vs camelCase)
- Requires separate comment fetches
- Response type: `BitbucketPullRequestsResponse`
- Additional: `BitbucketCommentsResponse` per PR

---

## Event Storage Implications

### What Should We Store?

**Option 1: Store Exact API Response**
- ✅ Complete audit trail
- ✅ Can re-parse if mapping logic changes
- ❌ Large storage size (includes all nested data)
- ❌ Different structures for each fetch type

**Option 2: Store Normalized MRs**
- ✅ Consistent structure
- ✅ Smaller storage
- ❌ Loses original API response
- ❌ Can't change normalization retroactively

**Option 3: Store Both (Hybrid)**
- Store raw response in event
- Cache normalized MRs in projection
- ✅ Best of both worlds
- ❌ More complex

### Recommended Approach: Option 1 (Store Exact Response)

**Rationale:**
1. Event sourcing principle: store immutable facts
2. API response = fact, normalization = interpretation
3. Can update normalization logic and replay events
4. Storage is cheap, flexibility is valuable

### Event Structure

```typescript
type FetchEvent =
  | GitLabUserFetchEvent
  | GitLabProjectFetchEvent
  | BitbucketRepoFetchEvent;

type GitLabUserFetchEvent = {
  eventId: number
  timestamp: Date
  fetchType: 'gitlab-user'
  scope: {
    type: 'user'
    usernames: string[]
    state: MergeRequestState
  }
  rawResponse: MRsQuery  // Exact GraphQL response
}

type GitLabProjectFetchEvent = {
  eventId: number
  timestamp: Date
  fetchType: 'gitlab-project'
  scope: {
    type: 'repo'
    projectPath: string
    state: MergeRequestState
  }
  rawResponse: ProjectMRsQuery  // Exact GraphQL response
}

type BitbucketRepoFetchEvent = {
  eventId: number
  timestamp: Date
  fetchType: 'bitbucket-repo'
  scope: {
    type: 'repo'
    workspace: string
    repoSlug: string
    state: string
  }
  rawResponse: {
    prs: BitbucketPullRequestsResponse
    comments: Map<number, BitbucketCommentsResponse>  // PR ID → comments
  }
}
```

### Single MR Refresh Strategy

**Current Issue:** `getMrPipeline()` only returns pipeline data, not full MR

**Options:**

1. **Don't support single-MR refresh initially**
   - Just support repo/user syncs
   - Simplest approach

2. **Fetch full MR via REST API**
   - GitLab REST: `/projects/:id/merge_requests/:iid`
   - Returns complete MR data
   - Add new fetch type: `'gitlab-single-mr'`

3. **Partial updates in projection**
   - Store pipeline-only events
   - Merge with existing MR in projection
   - More complex projection logic

**Recommendation:** Option 2 (Full MR fetch via REST)
- Simplest projection logic (always full MR data)
- Consistent with event-sourcing (complete facts)
- Can implement later

---

## Bitbucket Comment Fetching

**Important:** Bitbucket requires separate API call per PR to get comments

**Current Approach:**
- Fetches all PRs first
- Then fetches comments for each PR in parallel (unbounded concurrency)
- Returns combined data

**Event Storage Question:**
Should we store comment responses separately or combined with PR response?

**Option A: Combined (Current approach)**
```typescript
rawResponse: {
  prs: BitbucketPullRequestsResponse,
  comments: Map<number, BitbucketCommentsResponse>
}
```

**Option B: Separate Events**
- One event for PR fetch
- Separate events for each comment fetch
- More events, more granular

**Recommendation: Option A (Combined)**
- Single logical fetch operation = single event
- Matches current behavior
- Comments are essential part of MR data

---

## Summary: Fetch Methods to Support

### Phase 4 Implementation

1. **GitLab User Sync**
   - Fetch type: `'gitlab-user'`
   - Query: `MRs`
   - Response: `MRsQuery`

2. **GitLab Project Sync**
   - Fetch type: `'gitlab-project'`
   - Query: `ProjectMRs`
   - Response: `ProjectMRsQuery`

3. **Bitbucket Repo Sync**
   - Fetch type: `'bitbucket-repo'`
   - API: REST v2.0
   - Response: `{ prs, comments }`

### Future Enhancements

4. **GitLab Single MR Refresh** (Phase 4 or later)
   - Fetch type: `'gitlab-single-mr'`
   - API: REST `/projects/:id/merge_requests/:iid`
   - Response: Single MR JSON

5. **Bitbucket Single PR Refresh** (Phase 4 or later)
   - Fetch type: `'bitbucket-single-pr'`
   - API: REST `/repositories/.../pullrequests/:id`
   - Response: Single PR JSON + comments

---

## Action Items

- [x] Document all existing fetch methods
- [ ] Refine event types to match actual responses
- [ ] Update Phase 1 event schema if needed
- [ ] Implement Phase 2 parsers for each fetch type
- [ ] Design Phase 4 sync functions

---

## Files to Reference

### Existing Code
- `src/gitlab/gitlabgraphql.ts` - GitLab fetch functions
- `src/bitbucket/bitbucketapi.ts` - Bitbucket fetch functions
- `src/graphql/*.graphql` - GraphQL queries
- `src/generated/gitlab-sdk.ts` - Generated TypeScript types

### Event Sourcing Implementation
- `src/events/eventTypes.ts` - Event schema (to be refined)
- `src/events/eventStorage.ts` - Event storage
- Future: `src/events/parsers/` - Response parsers
