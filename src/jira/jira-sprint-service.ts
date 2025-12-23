import { Effect, Console, Schema } from "effect";
import {
  JiraSprintListResponseSchema,
  JiraSprintIssuesResponseSchema,
  type JiraSprint,
  type JiraSprintIssue,
  type JiraSprintTree,
  type JiraSprintTreeNode,
} from "./jira-sprint-schema";
import type { JiraIssue } from "./jira-schema";
import type { JiraSprintIssuesFetchedEvent } from "../events/jira-events";
import { generateEventId } from "../events/event-id";
import { JiraApiError, getAuthToken, getJiraBaseUrl, JIRA_ISSUE_FIELDS } from "./jira-common";

export const fetchActiveSprint = Effect.fn("fetchActiveSprint")(function* (boardId: number) {
  const authToken = getAuthToken();
  const baseUrl = getJiraBaseUrl();

  const response = yield* Effect.tryPromise({
    try: () => fetch(
      `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }),
    catch: cause => new JiraApiError({ cause, message: "Failed to fetch active sprint" })
  });

  if (!response.ok) {
    const errorText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: cause => new JiraApiError({ cause, message: "Failed to read error response" })
    });
    yield* Console.error("Jira API error response:", errorText);
    throw new JiraApiError({ cause: errorText, message: `Jira API error: ${response.status}` });
  }

  const jsonData = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: cause => new JiraApiError({ cause, message: "Failed to parse sprint response" })
  });

  const result = yield* Effect.tryPromise({
    try: () => Schema.decodeUnknownPromise(JiraSprintListResponseSchema)(jsonData),
    catch: cause => new JiraApiError({ cause, message: "Failed to decode sprint response" })
  });

  const activeSprint = result.values.find(s => s.state === 'active');
  return activeSprint ?? null;
});

export const fetchSprintIssues = Effect.fn("fetchSprintIssues")(function* (sprintId: number) {
  const authToken = getAuthToken();
  const baseUrl = getJiraBaseUrl();
  const fields = JIRA_ISSUE_FIELDS.join(',');

  const allIssues: JiraSprintIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const response = yield* Effect.tryPromise({
      try: () => fetch(
        `${baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authToken}`,
            'Content-Type': 'application/json',
          },
        }),
      catch: cause => new JiraApiError({ cause, message: "Failed to fetch sprint issues" })
    });

    if (!response.ok) {
      const errorText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: cause => new JiraApiError({ cause, message: "Failed to read error response" })
      });
      yield* Console.error("Jira API error response:", errorText);
      throw new JiraApiError({ cause: errorText, message: `Jira API error: ${response.status}` });
    }

    const jsonData = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: cause => new JiraApiError({ cause, message: "Failed to parse issues response" })
    });

    console.log(JSON.stringify(jsonData))

    const result = yield* Effect.tryPromise({
      try: () => Schema.decodeUnknownPromise(JiraSprintIssuesResponseSchema)(jsonData),
      catch: cause => new JiraApiError({ cause, message: "Failed to decode issues response" })
    });

    allIssues.push(...result.issues);

    if (startAt + result.issues.length >= result.total) {
      break;
    }
    startAt += maxResults;
  }

  return allIssues;
});

export const buildSprintTree = (issues: JiraSprintIssue[]): JiraSprintTree => {
  const parentMap = new Map<string, JiraSprintIssue>();
  const childrenMap = new Map<string, JiraSprintIssue[]>();

  issues.forEach(issue => {
    const issueType = issue.fields.issuetype.name.toLowerCase();
    if (issueType === 'story' || issueType === 'bug' || issueType === 'task' || issueType === 'epic') {
      parentMap.set(issue.key, issue);
      if (!childrenMap.has(issue.key)) {
        childrenMap.set(issue.key, []);
      }
    }
  });

  issues.forEach(issue => {
    const parent = issue.fields.parent;
    if (parent) {
      const children = childrenMap.get(parent.key) ?? [];
      children.push(issue);
      childrenMap.set(parent.key, children);

      if (!parentMap.has(parent.key)) {
        const syntheticParent: JiraSprintIssue = {
          key: parent.key,
          id: '',
          self: '',
          fields: {
            summary: parent.fields.summary,
            status: {
              name: parent.fields.status.name,
              statusCategory: { name: '' },
            },
            issuetype: parent.fields.issuetype,
            parent: undefined,
            assignee: null,
          },
        };
        parentMap.set(parent.key, syntheticParent);
      }
    }
  });

  const tree: JiraSprintTree = [];
  const addedKeys = new Set<string>();

  parentMap.forEach((issue, key) => {
    if (!issue.fields.parent || !parentMap.has(issue.fields.parent.key)) {
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        tree.push({
          issue,
          children: childrenMap.get(key) ?? [],
          isExpanded: true,
        });
      }
    }
  });

  tree.sort((a, b) => {
    const statusOrder = getStatusOrder(a.issue.fields.status.name) - getStatusOrder(b.issue.fields.status.name);
    if (statusOrder !== 0) return statusOrder;
    return a.issue.key.localeCompare(b.issue.key);
  });

  tree.forEach(node => {
    node.children.sort((a, b) => {
      const statusOrder = getStatusOrder(a.fields.status.name) - getStatusOrder(b.fields.status.name);
      if (statusOrder !== 0) return statusOrder;
      return a.key.localeCompare(b.key);
    });
  });

  return tree;
};

const getStatusOrder = (status: string): number => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('done') || lowerStatus.includes('merged')) return 4;
  if (lowerStatus.includes('progress') || lowerStatus.includes('review')) return 1;
  if (lowerStatus.includes('qa') || lowerStatus.includes('test')) return 2;
  if (lowerStatus.includes('ready')) return 3;
  return 0;
};

export const loadActiveSprintTree = Effect.fn("loadActiveSprintTree")(function* (boardId: number) {
  const sprint = yield* fetchActiveSprint(boardId);
  if (!sprint) {
    return { sprint: null, tree: [] as JiraSprintTree };
  }

  const issues = yield* fetchSprintIssues(sprint.id);
  const tree = buildSprintTree(issues);

  return { sprint, tree };
});

// Convert JiraSprintIssue to JiraIssue for unified storage
export const convertSprintIssueToJiraIssue = (sprintIssue: JiraSprintIssue): JiraIssue => {

  type SourceJiraSprintIssueCommentBody = NonNullable<JiraSprintIssue['fields']['comment']>['comments'][0]['body'];
  type TargetJiraIssueCommentBody = JiraIssue['fields']['comment']['comments'][0]['body']
  const extractCommentBody = (body: SourceJiraSprintIssueCommentBody): TargetJiraIssueCommentBody => {
    if (typeof body === 'string') {
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] };
    }
    const res = body as JiraIssue['fields']['comment']['comments'][0]['body'];
    return res;
  };

  return {
    key: sprintIssue.key,
    id: sprintIssue.id,
    self: sprintIssue.self,
    fields: {
      summary: sprintIssue.fields.summary,
      parent: sprintIssue.fields.parent ? {
        key: sprintIssue.fields.parent.key,
        fields: {
          summary: sprintIssue.fields.parent.fields.summary,
          issuetype: sprintIssue.fields.parent.fields.issuetype,
        }
      } : undefined,
      status: {
        name: sprintIssue.fields.status.name,
        statusCategory: sprintIssue.fields.status.statusCategory,
      },
      assignee: sprintIssue.fields.assignee ? {
        displayName: sprintIssue.fields.assignee.displayName,
        emailAddress: sprintIssue.fields.assignee.emailAddress ?? '',
      } : null,
      priority: {
        name: sprintIssue.fields.priority?.name ?? 'Medium',
      },
      issuetype: sprintIssue.fields.issuetype,
      created: sprintIssue.fields.created ?? new Date().toISOString(),
      updated: sprintIssue.fields.updated ?? new Date().toISOString(),
      comment: {
        total: sprintIssue.fields.comment?.total ?? 0,
        comments: (sprintIssue.fields.comment?.comments ?? []).map(c => ({
          id: c.id,
          author: {
            displayName: c.author.displayName,
            emailAddress: c.author.emailAddress,
          },
          body: extractCommentBody(c.body),
          created: c.created,
          updated: c.updated,
        })),
      },
      subtasks: sprintIssue.fields.subtasks ?? undefined,
    },
  };
};

export const loadActiveSprintTreeAsEvent = Effect.fn("loadActiveSprintTreeAsEvent")(function* (boardId: number) {
  const sprint = yield* fetchActiveSprint(boardId);
  if (!sprint) {
    return { sprint: null, tree: [] as JiraSprintTree, event: null };
  }

  const sprintIssues = yield* fetchSprintIssues(sprint.id);
  const tree = buildSprintTree(sprintIssues);

  // Convert sprint issues to JiraIssue format for unified storage
  const jiraIssues = sprintIssues.map(convertSprintIssueToJiraIssue);

  const timestamp = new Date().toISOString();
  const type = 'jira-sprint-issues-fetched-event' as const;
  const event: JiraSprintIssuesFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    sprintId: sprint.id,
    boardId,
    issues: jiraIssues,
    timestamp,
  };

  return { sprint, tree, event };
});
