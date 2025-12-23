import { Data } from "effect";

export class JiraApiError extends Data.TaggedError("JiraApiError")<{
  cause: unknown;
  message: string;
}> {}

export const getAuthToken = (): string => {
  if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
    const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    return Buffer.from(credentials).toString('base64');
  } else if (process.env.JIRA_API_TOKEN_BASE64) {
    return process.env.JIRA_API_TOKEN_BASE64;
  }
  throw new Error("Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN in .env");
};

export const getJiraBaseUrl = (): string => {
  return process.env.JIRA_BASE_URL || 'https://scisure.atlassian.net';
};

export const JIRA_ISSUE_FIELDS = [
  'summary',
  'parent',
  'status',
  'assignee',
  'priority',
  'issuetype',
  'created',
  'updated',
  'comment',
  'subtasks',
] as const;
