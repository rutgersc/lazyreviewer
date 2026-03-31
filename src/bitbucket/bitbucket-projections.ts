import type { MergeRequest, Discussion, DiscussionNote } from "../domain/merge-request-schema";
import { MrGid, MrIid } from "../domain/identifiers";
import { extractJiraKeys } from "../jira/jira-service";
import type { BitbucketPrsFetchedEvent, BitbucketSinglePrFetchedEvent, BitbucketPrCommentsFetchedEvent } from "../events/bitbucket-events";
import type { BitbucketPullRequest, BitbucketComment } from "./bitbucketapi";
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";

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

function mapBitbucketCommentsToDiscussions(comments: readonly BitbucketComment[]): Discussion[] {
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
      authorUsername: comment.user.nickname ?? comment.user.display_name,
      createdAt: new Date(comment.created_on),
      resolvable: true,
      system: false,
      resolved: comment.resolution !== null && comment.resolution !== undefined,
      url: comment.links.self.href ?? "",
      position: comment.inline ? {
        filePath: comment.inline.path,
        newLine: comment.inline.to || null,
        oldLine: comment.inline.from || null,
        oldPath: null,
      } : null,
    } satisfies DiscussionNote));

    return {
      id: `bitbucket-discussion-${topComment.id}`,
      resolved: isResolved,
      resolvable: true,
      notes,
    };
  });
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

export function mapBitbucketToMergeRequest(
  pr: BitbucketPullRequest,
  workspace: string,
  repoSlug: string,
  commentData?: { total: number; resolved: number; unresolved: number; comments: readonly BitbucketComment[] }
): MergeRequest {
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
    id: MrGid(`bitbucket-${workspace}-${repoSlug}-${pr.id}`),
    iid: MrIid(String(pr.id)),
    provider: 'bitbucket',
    title: pr.title,
    description: pr.description ?? null,
    jiraIssueKeys: extractJiraKeys(pr.title, pr.source.branch.name),
    webUrl: pr.links.html.href,
    sourcebranch: pr.source.branch.name,
    targetbranch: pr.destination.branch.name,
    diffHeadSha: pr.source.commit?.hash ?? null,
    detailedMergeStatus: null,
    project: {
      name: pr.destination.repository.name || repoSlug,
      path: repoSlug,
      fullPath: `${workspace}/${repoSlug}`
    },
    author: pr.author.nickname || pr.author.display_name,
    avatarUrl: null,
    createdAt: new Date(pr.created_on),
    updatedAt: new Date(pr.updated_on),
    state: mapBitbucketStateToGitlab(pr.state) as MergeRequestState,
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

export const projectBitbucketPrsFetchedEvent = (
  event: BitbucketPrsFetchedEvent,
  commentCountsMap: Map<number, { total: number; resolved: number; unresolved: number; comments: readonly BitbucketComment[] }>
): MergeRequest[] => {
  return event.prsResponse.values.map(pr => mapBitbucketToMergeRequest(pr, event.forWorkspace, event.forRepoSlug, commentCountsMap.get(pr.id)));
};

export const projectBitbucketPrCommentsFetchedEvent = (event: BitbucketPrCommentsFetchedEvent): readonly BitbucketComment[] => {
  return event.commentsResponse.values || [];
};

export const projectBitbucketSinglePrFetchedEvent = (
  event: BitbucketSinglePrFetchedEvent,
  commentData: { total: number; resolved: number; unresolved: number; comments: readonly BitbucketComment[] }
): MergeRequest => {
  return mapBitbucketToMergeRequest(event.pr, event.forWorkspace, event.forRepoSlug, commentData);
};

