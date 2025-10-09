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
  participants: BitbucketParticipant[];
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

    return data.values.map(pr => mapBitbucketToGitlabMergeRequest(pr, workspace, repoSlug));
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
  repoSlug: string
): GitlabMergeRequest {
  const approvedBy = pr.participants
    .filter(p => p.approved)
    .map(p => ({
      id: p.user.uuid || p.user.account_id || p.user.nickname || 'unknown',
      name: p.user.display_name,
      username: p.user.nickname || p.user.display_name
    }));

  return {
    id: `bitbucket-${workspace}-${repoSlug}-${pr.id}`,
    iid: String(pr.id),
    title: pr.title,
    jiraIssueKeys: extractElabTicketsFromTitle(pr.title),
    webUrl: pr.links.html.href,
    sourcebranch: pr.source.branch.name,
    targetbranch: pr.destination.branch.name,
    project: {
      name: repoSlug,
      path: repoSlug,
      fullPath: `${workspace}/${repoSlug}`
    },
    author: pr.author.nickname || pr.author.display_name,
    avatarUrl: null,
    createdAt: new Date(pr.created_on),
    updatedAt: new Date(pr.updated_on),
    state: mapBitbucketStateToGitlab(pr.state),
    approvedBy,
    resolvableDiscussions: 0,
    resolvedDiscussions: 0,
    unresolvedDiscussions: 0,
    totalDiscussions: pr.comment_count || 0,
    discussions: [],
    pipeline: {
      stage: []
    }
  };
}
