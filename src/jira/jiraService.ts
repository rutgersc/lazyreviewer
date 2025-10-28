import { Data, Effect } from "effect";

export type JiraStatusName =
  | "FINAL REVIEW"
  | "TEST IN PROGRESS"
  | "To Do"
  | "Done"
  | "Merge Requested"
  | "Merged"
  | "Pending"
  | "In Progress";

export interface JiraComment {
  id: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  body: {
    content: Array<{
      content: Array<{
        text?: string;
        type: string;
      }>;
      type: string;
    }>;
    type: string;
  };
  created: string;
  updated: string;
}

export interface JiraIssue {
  key: string;
  id: string,
  self: string,
  fields: {
    summary: string;
    parent?: {
      key: string;
      fields: {
        summary: string;
        issuetype: {
          name: string;
        };
      };
    };
    status: {
      name: JiraStatusName;
      statusCategory: {
        name: string;
      };
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    } | null;
    priority: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    created: string;
    updated: string;
    comment: {
      total: number;
      comments: JiraComment[];
    };
  };
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
}

const elabPattern = /ELAB-\d+/g;
export const extractElabTicketsFromTitle = (title: string): string[] => {
  const matches = title.match(elabPattern) ?? [];
  return Array.from(matches);
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

const searchIssues = async (baseUrl: string, apiToken: string, jql: string, maxResults: number = 100): Promise<JiraSearchResponse> => {
  // documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post
  const response = await fetch(
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
          'parent.issuetype'
        ],
      })
    });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Jira API error response:", errorText);
    throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as JiraSearchResponse;

  // Write the raw response to a JSON file for debugging
  // const fs = require('fs');
  // const path = require('path');
  // const outputPath = path.join(process.cwd(), 'debug/jira-response-debug.json');
  // fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  // console.log(`Jira response written to: ${outputPath}`);

  return data;
}

export class FetchJiraTicketsFailedError extends Data.TaggedError("Error1")<{
  cause: unknown;
}> { }

export const loadJiraTickets = Effect.fn("loadJiraTickets")(function* (ticketKeys: string[]) {
  if (ticketKeys.length === 0) {
    return [];
  }

  // Support both plain text (preferred) and pre-encoded base64 (legacy)
  let authToken: string;

  if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
    // Preferred: plain text credentials, we'll encode them
    const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    authToken = Buffer.from(credentials).toString('base64');
  } else if (process.env.JIRA_API_TOKEN_BASE64) {
    // Legacy: pre-encoded base64
    authToken = process.env.JIRA_API_TOKEN_BASE64;
  } else {
    throw new Error("Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN in .env");
  }

  const result = yield* Effect.tryPromise({
    try: () => searchIssues(
      'https://scisure.atlassian.net',
      authToken,
      `issuekey in (${ticketKeys.join(',')})`),
    catch: cause => new FetchJiraTicketsFailedError({ cause })
  });

  // Process each issue to limit comments to last 10 and sort by creation date
  const processedIssues = result.issues.map(issue => {
    if (issue.fields.comment?.comments) {
      // Sort comments by creation date (newest first) and take the last 10
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

  return processedIssues;
})
