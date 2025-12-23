import { Data, Effect, Console, Schema } from "effect";
import {
  JiraStatusNameSchema,
  JiraCommentSchema,
  JiraIssueSchema,
  JiraSearchResponseSchema,
  type JiraStatusName,
  type JiraComment,
  type JiraIssue,
  type JiraSearchResponse
} from "./jira-schema";
import type { JiraIssuesFetchedEvent } from "../events/jira-events";
import { EventStorage, type LazyReviewerEvent } from "../events/events";
import { generateEventId } from "../events/event-id";

export type { JiraStatusName, JiraComment, JiraIssue, JiraSearchResponse };

const elabPattern = /ELAB-\d+/g;
export const extractElabTicketsFromTitle = (title: string): string[] => {
  const matches = title.match(elabPattern) ?? [];
  return Array.from(new Set(matches));
};

export const extractElabTicketsFromTitles = (titles: string[]): string[] => {
  const elabPattern = /ELAB-\d+/g;
  const tickets = new Set<string>();

  titles.forEach((title) => {
    const matches = title?.match(elabPattern);
    if (matches) {
      matches.forEach((match) => tickets.add(match));
    }
  });

  return Array.from(tickets);
};

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

export class SearchJiraIssuesError extends Data.TaggedError("SearchJiraIssuesError")<{
  cause: unknown;
  data?: string
}> { }

const searchIssues = Effect.fn("searchIssues")(function* (baseUrl: string, apiToken: string, jql: string, maxResults: number = 100) {
  // documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post
  const response = yield* Effect.tryPromise({
    try: () => fetch(
      `${baseUrl}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql,
          maxResults,
          fields: [
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
            'parent.issuetype'
          ],
        })
      }),
    catch: cause => new SearchJiraIssuesError({ cause })
  });

  if (!response.ok) {
    const errorText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: cause => new SearchJiraIssuesError({ cause })
    });
    yield* Console.error("Jira API error response:", errorText);
    throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const jsonData = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: cause => new SearchJiraIssuesError({ cause })
  });

  return yield* Effect.tryPromise({
    try: () => Schema.decodeUnknownPromise(JiraSearchResponseSchema)(jsonData),
    catch: cause => new SearchJiraIssuesError({ cause, data: jsonData })
  });
})

export class FetchJiraTicketsFailedError extends Data.TaggedError("Error1")<{
  cause: unknown;
}> { }

export const loadJiraTickets = Effect.fn(function* (ticketKeys: string[]) {
  const event = yield* loadJiraTicketsAsEvent(ticketKeys);
  return projectJiraIssuesFetchedEvent(event);
})

// Event-returning wrapper function
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
      searchResponse: emptyResponse,
      issues: emptyResponse,
      forTicketKeys: ticketKeys,
      timestamp
    };
    return event;
  }

  let authToken: string;

  if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
    const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    authToken = Buffer.from(credentials).toString('base64');
  } else if (process.env.JIRA_API_TOKEN_BASE64) {
    authToken = process.env.JIRA_API_TOKEN_BASE64;
  } else {
    throw new Error("Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN in .env");
  }

  const result = yield* searchIssues(
    'https://scisure.atlassian.net',
    authToken,
    `issuekey in (${ticketKeys.join(',')})`);

  const processedIssues = result.issues.map(issue => {
    if (issue.fields.comment?.comments) {
      const sortedComments = issue.fields.comment.comments
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .slice(0, 10);

      return {
        ...issue,
        fields: {
          ...issue.fields,
          comment: {
            ...issue.fields.comment,
            comments: sortedComments
          }
        }
      };
    }
    return issue;
  });

  const processedResponse: JiraSearchResponse = {
    ...result,
    issues: processedIssues
  };

  const timestamp = new Date().toISOString();
  const type = 'jira-issues-fetched-event' as const;
  const event: JiraIssuesFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    searchResponse: result,
    issues: processedResponse,
    forTicketKeys: ticketKeys,
    timestamp
  };

  return event;
});

// Projection function
export const projectJiraIssuesFetchedEvent = (event: JiraIssuesFetchedEvent): JiraIssue[] => {
  return event.issues.issues;
};
