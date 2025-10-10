import type { GitlabMergeRequest } from "../gitlab/gitlabgraphql";
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

async function fetchBitbucketComments(
  workspace: string,
  repoSlug: string,
  prId: number,
  authToken: string
): Promise<BitbucketComment[]> {
  const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`[BitBucket] Failed to fetch comments for PR ${prId}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as BitbucketCommentsResponse;
    return data.values || [];
  } catch (error) {
    console.error(`[BitBucket] Error fetching comments for PR ${prId}:`, error);
    return [];
  }
}

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

async function fetchCommentsForAllPrs(
  workspace: string,
  repoSlug: string,
  prs: BitbucketPullRequest[],
  authToken: string
): Promise<Map<number, { total: number; resolved: number; unresolved: number }>> {
  console.log(`[BitBucket] Fetching comments for ${prs.length} PRs in parallel...`);

  const commentPromises = prs.map(async (pr) => {
    const comments = await fetchBitbucketComments(workspace, repoSlug, pr.id, authToken);
    const counts = countCommentsByResolution(comments);
    return { prId: pr.id, counts };
  });

  const results = await Promise.all(commentPromises);

  const commentCountsMap = new Map<number, { total: number; resolved: number; unresolved: number }>();
  results.forEach(({ prId, counts }) => {
    commentCountsMap.set(prId, counts);
  });

  console.log(`[BitBucket] Fetched comments for ${commentCountsMap.size} PRs`);
  return commentCountsMap;
}

export async function getBitbucketPrs(
  workspace: string,
  repoSlug: string,
  state: 'opened' | 'merged' | 'closed' | 'all' | 'locked' = 'opened'
): Promise<GitlabMergeRequest[]> {
  if (!(process.env.BITBUCKET_EMAIL && process.env.BITBUCKET_API_TOKEN)) {
    throw new Error("BitBucket credentials not configured. Set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in .env");
  }

  const credentials = `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_API_TOKEN}`;
  const authToken = Buffer.from(credentials).toString("base64");

  const bbState = mapStateTobitbucket(state);
  const url = bbState === 'ALL'
    ? `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?pagelen=50`
    : `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=${bbState}&pagelen=50`;

  console.log(`[BitBucket] Fetching PRs for ${workspace}/${repoSlug}, state: ${bbState}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`BitBucket API error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`BitBucket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BitbucketPullRequestsResponse;

    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(process.cwd(), 'debug/bitbucket-response-debug.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`BitBucket response written to: ${outputPath}`);

    const commentCountsMap = await fetchCommentsForAllPrs(workspace, repoSlug, data.values, authToken);

    return data.values.map(pr => mapBitbucketToGitlabMergeRequest(pr, workspace, repoSlug, commentCountsMap.get(pr.id)));
  } catch (error) {
    console.error('[BitBucket] Failed to fetch pull requests:', error);
    throw error;
  }
}

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
  commentCounts?: { total: number; resolved: number; unresolved: number }
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

  const resolvedDiscussions = commentCounts?.resolved || 0;
  const unresolvedDiscussions = commentCounts?.unresolved || 0;
  const totalDiscussions = commentCounts?.total || pr.comment_count || 0;
  const resolvableDiscussions = totalDiscussions;

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
    discussions: [],
    pipeline: {
      stage: []
    }
  };
}
