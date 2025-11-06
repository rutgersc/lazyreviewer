# Phase 2: Raw Response Normalization

## Goal
Parse raw API responses from events into unified MR schema with unique identifiers.

## Dependencies
- Phase 1 complete (event storage available)
- Can be developed in parallel with Phase 1

## Tasks

### Task 2.1: Response Parser Interface

**Define parser contract for each provider:**

```typescript
// src/events/responseParsers.ts

interface ResponseParser {
  // Parse raw response into MR array
  parse(rawResponse: unknown): MergeRequest[]

  // Validate response format (optional)
  validate(rawResponse: unknown): boolean
}

// Parser implementations
export const GitLabGraphQLParser: ResponseParser
export const GitLabRESTParser: ResponseParser
export const BitbucketRESTParser: ResponseParser
```

**Parser Registry:**
```typescript
// Determine parser based on fetchType and response structure
export const getParser = (
  fetchType: FetchType,
  rawResponse: unknown
): ResponseParser => {
  // Detection logic based on response shape
  if (isGitLabGraphQLResponse(rawResponse)) {
    return GitLabGraphQLParser;
  } else if (isBitbucketResponse(rawResponse)) {
    return BitbucketRESTParser;
  } else if (isGitLabRESTResponse(rawResponse)) {
    return GitLabRESTParser;
  }
  throw new Error('Unknown response format');
};
```

### Task 2.2: MR Unique Identifier

**Define MR identity across providers:**

```typescript
// src/events/mrIdentity.ts

// Unique identifier format: "provider:project:mrNumber"
type MRId = string & { readonly __brand: 'MRId' };

// Examples:
// - "gitlab:elab/elab:123"
// - "bitbucket:raftdev/core.iam:456"

export const createMRId = (
  provider: 'gitlab' | 'bitbucket',
  projectPath: string,
  mrNumber: number
): MRId => {
  return `${provider}:${projectPath}:${mrNumber}` as MRId;
};

export const getMRId = (mr: GitlabMergeRequest): MRId => {
  // Detect provider from MR structure or metadata
  const provider = detectProvider(mr);
  return createMRId(provider, mr.project.fullPath, mr.iid);
};

export const parseMRId = (mrId: MRId): {
  provider: 'gitlab' | 'bitbucket';
  projectPath: string;
  mrNumber: number;
} => {
  const [provider, ...rest] = mrId.split(':');
  const mrNumber = rest.pop()!;
  const projectPath = rest.join(':');
  return {
    provider: provider as 'gitlab' | 'bitbucket',
    projectPath,
    mrNumber: parseInt(mrNumber, 10)
  };
};
```

**Provider Detection:**
```typescript
const detectProvider = (mr: GitlabMergeRequest): 'gitlab' | 'bitbucket' => {
  // Use existing logic from parseRepositoryId
  // Or add provider field to MR schema
  if (mr.webUrl.includes('gitlab')) return 'gitlab';
  if (mr.webUrl.includes('bitbucket')) return 'bitbucket';
  throw new Error('Unknown provider');
};
```

### Task 2.3: Implement Parsers

**GitLab GraphQL Parser:**

```typescript
// src/events/parsers/gitlabGraphQLParser.ts

export const GitLabGraphQLParser: ResponseParser = {
  validate(rawResponse: unknown): boolean {
    return (
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      'data' in rawResponse &&
      typeof rawResponse.data === 'object'
    );
  },

  parse(rawResponse: unknown): MergeRequest[] {
    // Expected structure from getGitlabMrs() query:
    // {
    //   data: {
    //     mergeRequests: {
    //       nodes: [ { ...MR fields... } ]
    //     }
    //   }
    // }

    const data = (rawResponse as any).data;
    const nodes = data?.mergeRequests?.nodes || [];

    return nodes.map(node => {
      // Transform GraphQL response to GitlabMergeRequest schema
      return normalizeGitLabGraphQLNode(node);
    });
  }
};

const normalizeGitLabGraphQLNode = (node: any): GitlabMergeRequest => {
  // Map GraphQL fields to MR schema
  // This is similar to existing transformation in getGitlabMrs()
  return {
    id: node.id,
    iid: node.iid,
    title: node.title,
    // ... map all fields
    project: {
      id: node.project.id,
      fullPath: node.project.fullPath,
      // ...
    },
    // ...
  };
};
```

**GitLab REST Parser (for single MR):**

```typescript
// src/events/parsers/gitlabRESTParser.ts

export const GitLabRESTParser: ResponseParser = {
  validate(rawResponse: unknown): boolean {
    // GitLab REST returns single MR object or array
    return (
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      ('iid' in rawResponse || Array.isArray(rawResponse))
    );
  },

  parse(rawResponse: unknown): MergeRequest[] {
    if (Array.isArray(rawResponse)) {
      return rawResponse.map(normalizeGitLabRESTObject);
    } else {
      return [normalizeGitLabRESTObject(rawResponse as any)];
    }
  }
};

const normalizeGitLabRESTObject = (obj: any): GitlabMergeRequest => {
  // Map REST response to MR schema
  // REST and GraphQL have different field names/structures
  return {
    id: obj.id.toString(),
    iid: obj.iid,
    title: obj.title,
    // ... map REST fields to schema
  };
};
```

**Bitbucket REST Parser:**

```typescript
// src/events/parsers/bitbucketRESTParser.ts

export const BitbucketRESTParser: ResponseParser = {
  validate(rawResponse: unknown): boolean {
    return (
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      'values' in rawResponse
    );
  },

  parse(rawResponse: unknown): MergeRequest[] {
    // Expected structure: { values: [...PRs...] }
    const values = (rawResponse as any).values || [];

    return values.map(normalizeBitbucketPR);
  }
};

const normalizeBitbucketPR = (pr: any): GitlabMergeRequest => {
  // Use existing logic from getBitbucketPrs()
  // Map Bitbucket PR fields to GitlabMergeRequest schema
  return {
    id: pr.id.toString(),
    iid: pr.id,
    title: pr.title,
    // ... existing Bitbucket mapping
  };
};
```

### Task 2.4: Parser Testing

**Create test fixtures for each response type:**

```typescript
// src/events/parsers/__tests__/fixtures.ts

export const gitlabGraphQLResponse = {
  data: {
    mergeRequests: {
      nodes: [
        // Sample MR from actual API response
      ]
    }
  }
};

export const bitbucketRESTResponse = {
  values: [
    // Sample PR from actual API response
  ]
};

// Test parser against fixtures
describe('GitLabGraphQLParser', () => {
  it('should parse GraphQL response', () => {
    const mrs = GitLabGraphQLParser.parse(gitlabGraphQLResponse);
    expect(mrs).toHaveLength(1);
    expect(mrs[0].iid).toBeDefined();
  });
});
```

## Files to Create/Modify

### New Files
- `src/events/responseParsers.ts` - Parser interface and registry
- `src/events/mrIdentity.ts` - MR unique ID utilities
- `src/events/parsers/gitlabGraphQLParser.ts`
- `src/events/parsers/gitlabRESTParser.ts`
- `src/events/parsers/bitbucketRESTParser.ts`
- `src/events/parsers/__tests__/` - Parser tests

### Files to Reference
- `src/gitlab/gitlabgraphql.ts` - Existing GraphQL response handling
- `src/bitbucket/bitbucketapi.ts` - Existing Bitbucket normalization
- `src/schemas/mergeRequestSchema.ts` - Target MR schema

## Edge Cases to Handle

### Incomplete Data
- Missing optional fields (assignees, labels, etc.)
- Null values in response
- Default to sensible empty values

### Invalid Responses
- Malformed JSON
- Unexpected structure
- Log error, return empty array (don't crash projection)

### Provider Quirks
- GitLab: GraphQL vs REST field naming differences
- Bitbucket: Different discussion format
- Handle both gracefully

## Success Criteria

- ✅ All three parsers (GitLab GraphQL, GitLab REST, Bitbucket) implemented
- ✅ MRId uniquely identifies MRs across providers
- ✅ Same MR from different fetches maps to same ID
- ✅ Parsers handle missing/null fields gracefully
- ✅ Invalid responses logged but don't crash
- ✅ Test coverage for all parsers with real API responses

## Performance Considerations

- **Parsing Speed**: Each event parses ~25 MRs (~1-2ms per event)
- **Memory**: Parsed MRs created temporarily during projection
- **Validation**: Optional validate() can be skipped in production for speed

## Next Phase Dependencies

Phase 3 (Projection Engine) will:
- Use these parsers to extract MRs from event rawResponse
- Build Map<MRId, MergeRequest> from parsed MRs
- Apply last-write-wins using event timestamps
