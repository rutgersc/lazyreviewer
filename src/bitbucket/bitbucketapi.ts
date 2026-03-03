import { Console, Data, Effect } from "effect";
import type { MergeRequest } from "../domain/merge-request-schema";
import type { BitbucketPrsFetchedEvent, BitbucketSinglePrFetchedEvent, BitbucketPrCommentsFetchedEvent } from "../events/bitbucket-events";
import { projectBitbucketPrsFetchedEvent, projectBitbucketPrCommentsFetchedEvent, projectBitbucketSinglePrFetchedEvent } from "./bitbucket-projections";
import { generateEventId } from "../events/event-id";
import { UnauthorizedError } from "../domain/unauthorized-error";
import * as fs from 'fs';
import * as path from 'path';

export interface BitbucketAccount {
  display_name: string;
  uuid: string;
  account_id?: string;
  nickname?: string;
}

export interface BitbucketBranch {
  name: string;
}

export interface BitbucketCommit {
  hash: string;
}

export interface BitbucketRepository {
  name: string;
  full_name: string;
}

export interface BitbucketSource {
  branch: BitbucketBranch;
  commit: BitbucketCommit;
  repository: BitbucketRepository;
}

export interface BitbucketDestination {
  branch: BitbucketBranch;
  commit: BitbucketCommit;
  repository: BitbucketRepository;
}

export interface BitbucketParticipant {
  user: BitbucketAccount;
  role: string;
  approved: boolean;
  participated_on?: string;
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description?: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  author: BitbucketAccount;
  source: BitbucketSource;
  destination: BitbucketDestination;
  participants?: readonly BitbucketParticipant[];
  reviewers?: readonly BitbucketAccount[];
  created_on: string;
  updated_on: string;
  comment_count?: number;
  task_count?: number;
  links: {
    html: {
      href: string;
    };
    self: {
      href: string;
    };
  };
}

export interface BitbucketPullRequestsResponse {
  values: readonly BitbucketPullRequest[];
  page?: number;
  pagelen?: number;
  size?: number;
  next?: string;
}

export interface BitbucketCommentResolution {
  type: string;
  user: BitbucketAccount;
  created_on: string;
}

export interface BitbucketComment {
  id: number;
  created_on: string;
  updated_on: string;
  content: {
    raw: string;
    markup?: string;
    html?: string;
  };
  user: BitbucketAccount;
  deleted?: boolean;
  parent?: {
    id: number;
  };
  inline?: {
    from?: number;
    to?: number;
    path: string;
  };
  links: {
    self: {
      href: string;
    };
    html: {
      href: string;
    };
  };
  pullrequest?: {
    type: string;
    id: number;
  };
  resolution?: BitbucketCommentResolution | null;
}

export interface BitbucketCommentsResponse {
  values: readonly BitbucketComment[];
  page?: number;
  pagelen?: number;
  size?: number;
  next?: string;
}

export class FetchBitbucketPrCommentsError extends Data.TaggedError("FetchBitbucketPrCommentsError")<{
  cause: unknown;
}> { }

export class BitbucketCommentsJsonParseError extends Data.TaggedError("BitbucketCommentsJsonParseError")<{
  cause: unknown;
}> { }

export class BitbucketCredentialsNotConfiguredError extends Data.TaggedError("BitbucketCredentialsNotConfiguredError")<{
  message: string;
}> { }

export class FetchBitbucketPrsError extends Data.TaggedError("FetchBitbucketPrsError")<{
  cause: unknown;
  status: number;
  statusText: string;
}> { }

export class BitbucketPrsJsonParseError extends Data.TaggedError("BitbucketPrsJsonParseError")<{
  cause: unknown;
}> { }

const fetchBitbucketComments = Effect.fn("fetchBitbucketComments")(function* (workspace: string,
  repoSlug: string,
  prId: number,
  authToken: string) {
  const event = yield* fetchBitbucketCommentsAsEvent(workspace, repoSlug, prId, authToken);
  return projectBitbucketPrCommentsFetchedEvent(event);
});

function countCommentsByResolution(comments: readonly BitbucketComment[]): {
  total: number;
  resolved: number;
  unresolved: number;
} {
  const total = comments.length;
  const resolved = comments.filter(c => c.resolution !== null && c.resolution !== undefined).length;
  const unresolved = total - resolved;

  return { total, resolved, unresolved };
}

const fetchCommentsForAllPrs = Effect.fn("fetchCommentsForAllPrs")(function* (
  workspace: string,
  repoSlug: string,
  prs: readonly BitbucketPullRequest[],
  authToken: string
) {
  yield* Console.log(`[BitBucket] Fetching comments for ${prs.length} PRs in parallel...`);

  const results = yield* Effect.forEach(
    prs,
    (pr) => Effect.gen(function* () {
      const comments = yield* fetchBitbucketComments(workspace, repoSlug, pr.id, authToken).pipe(
        Effect.catchAll((error) => Effect.gen(function* () {
          yield* Console.error(`[BitBucket] Failed to fetch comments for PR ${pr.id}, using empty array:`, error);
          return [];
        }))
      );
      const counts = countCommentsByResolution(comments);
      return { prId: pr.id, counts, comments };
    }),
    { concurrency: "unbounded" }
  );

  const commentDataMap = new Map<number, { total: number; resolved: number; unresolved: number; comments: readonly BitbucketComment[] }>();
  results.forEach(({ prId, counts, comments }) => {
    commentDataMap.set(prId, { ...counts, comments });
  });

  yield* Console.log(`[BitBucket] Fetched comments for ${commentDataMap.size} PRs`);
  return commentDataMap;
});

export class FetchSingleBitbucketPrError extends Data.TaggedError("FetchSingleBitbucketPrError")<{
  cause: unknown;
  status: number;
  statusText: string;
}> { }

export const getSingleBitbucketPr = Effect.fn("getSingleBitbucketPr")(function* (
  workspace: string,
  repoSlug: string,
  prId: number
) {
  const event = yield* getSingleBitbucketPrAsEvent(workspace, repoSlug, prId);

  const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
  const authToken = Buffer.from(credentials).toString("base64");

  // Fetch comments for the PR
  const commentsEvent = yield* fetchBitbucketCommentsAsEvent(workspace, repoSlug, prId, authToken);
  const comments = projectBitbucketPrCommentsFetchedEvent(commentsEvent);

  const counts = countCommentsByResolution(comments);
  const commentData = { ...counts, comments };

  return projectBitbucketSinglePrFetchedEvent(event, commentData);
})

export const getBitbucketPrs = Effect.fn("getBitbucketPrs")(function* (
  workspace: string,
  repoSlug: string,
  state: 'opened' | 'merged' | 'closed' | 'all' | 'locked' = 'opened'
) {
  const event = yield* getBitbucketPrsAsEvent(workspace, repoSlug, state);

  const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
  const authToken = Buffer.from(credentials).toString("base64");

  const commentCountsMap = yield* fetchCommentsForAllPrs(workspace, repoSlug, event.prsResponse.values, authToken);

  return projectBitbucketPrsFetchedEvent(event, commentCountsMap);
});

function mapStateTobitbucket(state: 'opened' | 'merged' | 'closed' | 'all' | 'locked'): string {
  switch (state) {
    case 'opened':
      return 'OPEN';
    case 'merged':
      return 'MERGED';
    case 'closed':
      return 'DECLINED';
    case 'all':
      return 'ALL';
    case 'locked':
      // BitBucket doesn't have a 'locked' state, so we'll show all PRs
      return 'ALL';
    default:
      return 'OPEN';
  }
}

// Event-returning wrapper functions
export const getBitbucketPrsAsEvent = Effect.fn("getBitbucketPrsAsEvent")(function* (
  workspace: string,
  repoSlug: string,
  state: 'opened' | 'merged' | 'closed' | 'all' | 'locked' = 'opened'
) {
  if (!(process.env.BITBUCKET_EMAIL && process.env.BITBUCKET_API_TOKEN)) {
    return yield* Effect.fail(new BitbucketCredentialsNotConfiguredError({
      message: "BitBucket credentials not configured. Set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in .env"
    }));
  }

  const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
  const authToken = Buffer.from(credentials).toString("base64");

  const bbState = mapStateTobitbucket(state);
  const url = bbState === 'ALL'
    ? `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?pagelen=50`
    : `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=${bbState}&pagelen=50`;

  yield* Console.log(`[BitBucket] Fetching PRs for ${workspace}/${repoSlug}, state: ${bbState}`);

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    }),
    catch: (cause) => new FetchBitbucketPrsError({ cause, status: 0, statusText: 'Network error' })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(new UnauthorizedError({ service: 'Bitbucket', reason: `returned ${response.status} — credentials are invalid or expired` }));
    }
    const errorText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => 'Unable to read error response'
    });
    yield* Console.error(`BitBucket API error: ${response.status} ${response.statusText} - ${errorText}`);

    return yield* Effect.fail(new FetchBitbucketPrsError({
      cause: errorText,
      status: response.status,
      statusText: response.statusText
    }));
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<BitbucketPullRequestsResponse>,
    catch: (cause) => new BitbucketPrsJsonParseError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'bitbucket-prs-fetched-event' as const;
  const event: BitbucketPrsFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    prsResponse: data,
    forWorkspace: workspace,
    forRepoSlug: repoSlug,
    forState: state,
    timestamp
  };

  return event;
});

export const fetchBitbucketCommentsAsEvent = Effect.fn("fetchBitbucketCommentsAsEvent")(function* (
  workspace: string,
  repoSlug: string,
  prId: number,
  authToken: string
) {
  const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    }),
    catch: cause => new FetchBitbucketPrCommentsError({ cause })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(new UnauthorizedError({ service: 'Bitbucket', reason: `returned ${response.status} — credentials are invalid or expired` }));
    }
    yield* Console.error(`[BitBucket] Failed to fetch comments for PR ${prId}: ${response.status} ${response.statusText}`);
    const emptyResponse: BitbucketCommentsResponse = {
      values: []
    };
    const timestamp = new Date().toISOString();
    const type = 'bitbucket-pr-comments-fetched-event' as const;
    const event: BitbucketPrCommentsFetchedEvent = {
      eventId: generateEventId(timestamp, type),
      type,
      commentsResponse: emptyResponse,
      forWorkspace: workspace,
      forRepoSlug: repoSlug,
      forPrId: prId,
      timestamp
    };
    return event;
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<BitbucketCommentsResponse>,
    catch: cause => new BitbucketCommentsJsonParseError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'bitbucket-pr-comments-fetched-event' as const;
  const event: BitbucketPrCommentsFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    commentsResponse: data,
    forWorkspace: workspace,
    forRepoSlug: repoSlug,
    forPrId: prId,
    timestamp
  };

  return event;
});

export const getSingleBitbucketPrAsEvent = Effect.fn("getSingleBitbucketPrAsEvent")(function* (
  workspace: string,
  repoSlug: string,
  prId: number
) {
  if (!(process.env.BITBUCKET_EMAIL && process.env.BITBUCKET_API_TOKEN)) {
    return yield* Effect.fail(new BitbucketCredentialsNotConfiguredError({
      message: "BitBucket credentials not configured. Set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in .env"
    }));
  }

  const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
  const authToken = Buffer.from(credentials).toString("base64");

  const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`;

  yield* Console.log(`[BitBucket] Fetching single PR: ${prId} in ${workspace}/${repoSlug}`);

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    }),
    catch: (cause) => new FetchSingleBitbucketPrError({ cause, status: 0, statusText: 'Network error' })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(new UnauthorizedError({ service: 'Bitbucket', reason: `returned ${response.status} — credentials are invalid or expired` }));
    }
    const errorText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => 'Unable to read error response'
    });
    yield* Console.error(`BitBucket API error: ${response.status} ${response.statusText} - ${errorText}`);

    return yield* Effect.fail(new FetchSingleBitbucketPrError({
      cause: errorText,
      status: response.status,
      statusText: response.statusText
    }));
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<BitbucketPullRequest>,
    catch: (cause) => new BitbucketPrsJsonParseError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'bitbucket-single-pr-fetched-event' as const;
  const event: BitbucketSinglePrFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    pr: data,
    forWorkspace: workspace,
    forRepoSlug: repoSlug,
    forPrId: prId,
    timestamp
  };

  return event;
});
