import type { JiraIssue } from './jira-schema';
import type { JiraComment } from './jira-service';

export function jiraIssueUrl(issue: JiraIssue): string | null {
  const jiraBaseUrl = issue.self.split('/rest/')[0];
  return jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : null;
}

export function jiraCommentUrl(issue: JiraIssue, commentId: string): string | null {
  const issueUrl = jiraIssueUrl(issue);
  return issueUrl ? `${issueUrl}?focusedCommentId=${commentId}` : null;
}

// Newest first — the order comments are rendered in, so a cursor index means the same thing in both.
export function commentsNewestFirst(issue: JiraIssue): readonly JiraComment[] {
  return [...(issue.fields.comment.comments ?? [])].reverse();
}
