import { Effect, Console, Schema } from "effect";
import {
  JiraIssueSchema,
  JiraSearchResponseSchema,
  type JiraStatusName,
  type JiraComment,
  type JiraIssue,
  type JiraSearchResponse
} from "./jira-schema";
import type { JiraIssuesFetchedEvent } from "../events/jira-events";
import { generateEventId } from "../events/event-id";
import { JiraApiError, getAuthToken, JiraBaseUrl, JIRA_ISSUE_FIELDS } from "./jira-common";
import { UnauthorizedError } from "../domain/unauthorized-error";

export type { JiraStatusName, JiraComment, JiraIssue, JiraSearchResponse };

const elabPattern = /ELAB-\d+/g;
export const extractElabTickets = (...sources: readonly string[]): string[] =>
  Array.from(new Set(sources.flatMap(s => s.match(elabPattern) ?? [])));


export const extractTextFromJiraComment = (comment: JiraComment): string => {
  try {
    const parseContentBlock = (contentBlock: any): string => {
      if (!contentBlock) return '';

      // Handle different content types
      switch (contentBlock.type) {
        case 'paragraph':
          return parseContent(contentBlock.content) + '\n';

        case 'bulletList':
        case 'orderedList':
          return parseContent(contentBlock.content) + '\n';

        case 'listItem':
          return '• ' + parseContent(contentBlock.content);

        case 'text':
          return contentBlock.text || '';

        case 'mention':
          // Handle @mentions - show the text attribute which contains the display name
          const mentionText = contentBlock.attrs?.text || contentBlock.text || 'user';
          return mentionText.startsWith('@') ? mentionText : `@${mentionText}`;

        default:
          // For any other type, try to parse nested content
          return parseContent(contentBlock.content);
      }
    };

    const parseContent = (content: any[]): string => {
      if (!Array.isArray(content)) return '';

      return content
        .map(item => parseContentBlock(item))
        .filter(text => text.length > 0)
        .join('');
    };

    if (!comment.body?.content) return '';

    const result = parseContent(comment.body.content);
    return result.trim();
  } catch (error) {
    console.warn('Failed to extract text from Jira comment:', error);
    return '';
  }
};

const searchIssues = Effect.fn("searchIssues")(function* (jql: string, maxResults: number = 100) {
  const baseUrl = yield* JiraBaseUrl
  const authToken = yield* getAuthToken

  const response = yield* Effect.tryPromise({
    try: () => fetch(
      `${baseUrl}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql,
          maxResults,
          fields: [...JIRA_ISSUE_FIELDS, 'parent.issuetype'],
        })
      }),
    catch: cause => new JiraApiError({ cause, message: "Failed to search issues" })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return yield* new UnauthorizedError({ service: 'Jira', reason: `returned ${response.status} — credentials are invalid or expired` });
    }
    const errorText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: cause => new JiraApiError({ cause, message: "Failed to read error response" })
    });
    return yield* new JiraApiError({ cause: errorText, message: `Jira API error: ${response.status}` });
  }

  const jsonData = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: cause => new JiraApiError({ cause, message: "Failed to parse response" })
  });

  return yield* Effect.tryPromise({
    try: () => Schema.decodeUnknownPromise(JiraSearchResponseSchema)(jsonData),
    catch: cause => new JiraApiError({ cause, message: "Failed to decode response" })
  });
})

export const loadJiraTickets = Effect.fn(function* (ticketKeys: string[]) {
  const event = yield* loadJiraTicketsAsEvent(ticketKeys);
  return projectJiraIssuesFetchedEvent(event);
})

export const loadJiraTicketsAsEvent = Effect.fn(function* (ticketKeys: string[]) {
  if (ticketKeys.length === 0) {
    const emptyResponse: JiraSearchResponse = {
      issues: [],
      total: 0,
      maxResults: 0
    };
    const timestamp = new Date().toISOString();
    const type = 'jira-issues-fetched-event' as const;
    const event: JiraIssuesFetchedEvent = {
      eventId: generateEventId(timestamp, type),
      type,
      // searchResponse: emptyResponse,
      issues: emptyResponse,
      forTicketKeys: ticketKeys,
      timestamp
    };
    return event;
  }

  const result = yield* searchIssues(`issuekey in (${ticketKeys.join(',')})`);

  if (result.issues.length === 0) {
    return yield* new UnauthorizedError({
      service: 'Jira',
      reason: `searched ${ticketKeys.length} ticket keys but got 0 results — token is likely expired or invalid`
    });
  }


  const timestamp = new Date().toISOString();
  const type = 'jira-issues-fetched-event' as const;
  const event: JiraIssuesFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    issues: result,
    forTicketKeys: ticketKeys,
    timestamp
  };

  return event;
});

// Projection function
export const projectJiraIssuesFetchedEvent = (event: JiraIssuesFetchedEvent): JiraIssue[] => {
  return event.issues.issues;
};
