import { Console, Data, Effect } from "effect";
import type { GitlabMergeRequest, Discussion, DiscussionNote } from "../gitlab/gitlabgraphql";
import { extractElabTicketsFromTitle } from "../jira/jiraService";

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
  participants?: BitbucketParticipant[];
  reviewers?: BitbucketAccount[];
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
  values: BitbucketPullRequest[];
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
  values: BitbucketComment[];
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
    yield* Console.error(`[BitBucket] Failed to fetch comments for PR ${prId}: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<BitbucketCommentsResponse>,
    catch: cause => new BitbucketCommentsJsonParseError({ cause })
  });

  return data.values || [];
});

function countCommentsByResolution(comments: BitbucketComment[]): {
  total: number;
  resolved: number;
  unresolved: number;
} {
  const total = comments.length;
  const resolved = comments.filter(c => c.resolution !== null && c.resolution !== undefined).length;
  const unresolved = total - resolved;

  return { total, resolved, unresolved };
}

function mapBitbucketCommentsToDiscussions(comments: BitbucketComment[]): Discussion[] {
  const topLevelComments = comments.filter(c => !c.parent && !c.deleted);
  const commentReplies = comments.filter(c => c.parent && !c.deleted);

  const repliesByParent = new Map<number, BitbucketComment[]>();
  commentReplies.forEach(reply => {
    const parentId = reply.parent!.id;
    if (!repliesByParent.has(parentId)) {
      repliesByParent.set(parentId, []);
    }
    repliesByParent.get(parentId)!.push(reply);
  });

  return topLevelComments.map(topComment => {
    const replies = repliesByParent.get(topComment.id) || [];
    const allCommentsInThread = [topComment, ...replies];

    const isResolved = topComment.resolution !== null && topComment.resolution !== undefined;

    const notes: DiscussionNote[] = allCommentsInThread.map(comment => ({
      id: String(comment.id),
      body: comment.content.raw,
      author: comment.user.display_name,
      createdAt: new Date(comment.created_on),
      resolvable: true,
      resolved: comment.resolution !== null && comment.resolution !== undefined,
      position: comment.inline ? {
        filePath: comment.inline.path,
        newLine: comment.inline.to || null,
        oldLine: comment.inline.from || null,
        oldPath: null,
      } : null,
    }));

    return {
      id: `bitbucket-discussion-${topComment.id}`,
      resolved: isResolved,
      resolvable: true,
      notes,
    };
  });
}

const fetchCommentsForAllPrs = Effect.fn("fetchCommentsForAllPrs")(function* (
  workspace: string,
  repoSlug: string,
  prs: BitbucketPullRequest[],
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

  const commentDataMap = new Map<number, { total: number; resolved: number; unresolved: number; comments: BitbucketComment[] }>();
  results.forEach(({ prId, counts, comments }) => {
    commentDataMap.set(prId, { ...counts, comments });
  });

  yield* Console.log(`[BitBucket] Fetched comments for ${commentDataMap.size} PRs`);
  return commentDataMap;
});

export const getBitbucketPrs = Effect.fn("getBitbucketPrs")(function* (
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

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), 'debug/bitbucket-response-debug.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  yield* Console.log(`BitBucket response written to: ${outputPath}`);

  const commentCountsMap = yield* fetchCommentsForAllPrs(workspace, repoSlug, data.values, authToken);

  return data.values.map(pr => mapBitbucketToGitlabMergeRequest(pr, workspace, repoSlug, commentCountsMap.get(pr.id)));
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

function mapBitbucketStateToGitlab(state: BitbucketPullRequest['state']): string {
  switch (state) {
    case 'OPEN':
      return 'opened';
    case 'MERGED':
      return 'merged';
    case 'DECLINED':
    case 'SUPERSEDED':
      return 'closed';
    default:
      return 'opened';
  }
}

export function mapBitbucketToGitlabMergeRequest(
  pr: BitbucketPullRequest,
  workspace: string,
  repoSlug: string,
  commentData?: { total: number; resolved: number; unresolved: number; comments: BitbucketComment[] }
): GitlabMergeRequest {
  const approvedBy = pr.participants
    ? pr.participants
        .filter(p => p.approved)
        .map(p => ({
          id: p.user.uuid || p.user.account_id || p.user.nickname || 'unknown',
          name: p.user.display_name,
          username: p.user.nickname || p.user.display_name
        }))
    : [];

  const discussions = commentData ? mapBitbucketCommentsToDiscussions(commentData.comments) : [];
  const resolvedDiscussions = commentData?.resolved || 0;
  const unresolvedDiscussions = commentData?.unresolved || 0;
  const totalDiscussions = commentData?.total || pr.comment_count || 0;
  const resolvableDiscussions = discussions.filter(d => d.resolvable).length;

  return {
    id: `bitbucket-${workspace}-${repoSlug}-${pr.id}`,
    iid: String(pr.id),
    title: pr.title,
    jiraIssueKeys: extractElabTicketsFromTitle(pr.title),
    webUrl: pr.links.html.href,
    sourcebranch: pr.source.branch.name,
    targetbranch: pr.destination.branch.name,
    project: {
      name: pr.destination.repository.name || repoSlug,
      path: repoSlug,
      fullPath: `${workspace}/${repoSlug}`
    },
    author: pr.author.nickname || pr.author.display_name,
    avatarUrl: null,
    createdAt: new Date(pr.created_on),
    updatedAt: new Date(pr.updated_on),
    state: mapBitbucketStateToGitlab(pr.state),
    approvedBy,
    resolvableDiscussions,
    resolvedDiscussions,
    unresolvedDiscussions,
    totalDiscussions,
    discussions,
    pipeline: {
      stage: []
    }
  };
}
