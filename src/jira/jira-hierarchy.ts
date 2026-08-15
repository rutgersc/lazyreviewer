import type { JiraIssue } from './jira-schema';

export type JiraListItem = {
  issue: JiraIssue;
  isParent: boolean;
  indented: boolean;
  parentIssueIndex: number;
  subIndex: number;
};

// Parent story first, the MR's own issue indented beneath it.
export function buildJiraListItems(jiraIssues: readonly JiraIssue[]): JiraListItem[] {
  return jiraIssues.flatMap((issue, issueIndex): JiraListItem[] => {
    const parent = issue.fields.parent;

    if (!parent) {
      return [{ issue, isParent: false, indented: false, parentIssueIndex: issueIndex, subIndex: 0 }];
    }

    const parentAsIssue: JiraIssue = {
      key: parent.key,
      id: '',
      // The child's self carries the Jira host, which is all jiraIssueUrl needs.
      self: issue.self,
      fields: {
        summary: parent.fields.summary,
        parent: undefined,
        status: parent.fields.status ?? { name: '', statusCategory: { name: '' } },
        assignee: null,
        priority: { name: '' },
        issuetype: parent.fields.issuetype,
        created: '',
        updated: '',
        comment: { total: 0, comments: [] }
      }
    };

    return [
      { issue: parentAsIssue, isParent: true, indented: false, parentIssueIndex: issueIndex, subIndex: 0 },
      { issue, isParent: false, indented: true, parentIssueIndex: issueIndex, subIndex: 1 },
    ];
  });
}

export function findIssueRow(rows: readonly JiraListItem[], issueIndex: number): JiraListItem | undefined {
  return rows.find(row => row.parentIssueIndex === issueIndex && !row.isParent);
}
