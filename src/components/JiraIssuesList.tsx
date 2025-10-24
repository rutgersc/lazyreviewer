import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import JiraIssueInfo from './JiraIssueInfo';
import { Colors } from '../colors';
import type { JiraIssue } from '../jira/jiraService';
import { useAppStore } from '../store/appStore';
import { ActivePane } from '../userselection/userSelection';
import { openUrl } from '../system/url-effect';
import { copyToClipboard } from '../system/clipboard-effect';

interface JiraIssuesListProps {
  activePane: ActivePane;
  jiraIssues: JiraIssue[];
  selectedJiraIndex: number;
  selectedJiraSubIndex: number;
}

type JiraListItem = {
  issue: JiraIssue;
  isParent: boolean;
  parentIssueIndex: number;
  subIndex: number;
};

export default function JiraIssuesList({ activePane, jiraIssues, selectedJiraIndex, selectedJiraSubIndex }: JiraIssuesListProps) {
  const activeModal = useAppStore(state => state.activeModal);
  const infoPaneTab = useAppStore(state => state.infoPaneTab);
  const setSelectedJiraIndex = useAppStore(state => state.setSelectedJiraIndex);
  const setSelectedJiraSubIndex = useAppStore(state => state.setSelectedJiraSubIndex);

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'jira') return;
    if (activeModal !== 'none') return;
    if (jiraIssues.length === 0) return;

    const selectedIssue = jiraIssues[selectedJiraIndex];
    const hasParent = selectedIssue?.fields.parent !== undefined;
    const maxSubIndex = hasParent ? 1 : 0;

    switch (key.name) {
      case 'j':
      case 'down':
        if (selectedJiraSubIndex < maxSubIndex) {
          setSelectedJiraSubIndex(selectedJiraSubIndex + 1);
        } else if (selectedJiraIndex < jiraIssues.length - 1) {
          setSelectedJiraIndex(selectedJiraIndex + 1);
        }
        break;
      case 'k':
      case 'up':
        if (selectedJiraSubIndex > 0) {
          setSelectedJiraSubIndex(selectedJiraSubIndex - 1);
        } else if (selectedJiraIndex > 0) {
          setSelectedJiraIndex(selectedJiraIndex - 1);
        }
        break;
      case 'i':
      case 'return':
        if (selectedIssue) {
          const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
          const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
          openUrl(jiraUrl);
        }
        break;
      case 'c':
        if (selectedIssue) {
          const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
          const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
          copyToClipboard(jiraUrl);
        }
        break;
    }
  });
  if (jiraIssues.length === 0) {
    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          No Jira tickets
        </text>
      </box>
    );
  }

  const jiraListItems: JiraListItem[] = [];
  jiraIssues.forEach((issue, issueIndex) => {
    jiraListItems.push({
      issue,
      isParent: false,
      parentIssueIndex: issueIndex,
      subIndex: 0
    });

    if (issue.fields.parent) {
      const parentAsIssue: JiraIssue = {
        key: issue.fields.parent.key,
        id: '',
        self: '',
        fields: {
          summary: issue.fields.parent.fields.summary,
          parent: undefined,
          status: { name: 'To Do', statusCategory: { name: '' } },
          assignee: null,
          priority: { name: '' },
          issuetype: issue.fields.parent.fields.issuetype,
          created: '',
          updated: '',
          comment: { total: 0, comments: [] }
        }
      };

      jiraListItems.push({
        issue: parentAsIssue,
        isParent: true,
        parentIssueIndex: issueIndex,
        subIndex: 1
      });
    }
  });

  const selectedListItem = jiraListItems.find(
    item => item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex
  );

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {jiraListItems.map((item) => {
          const isSelected = item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex;

          return (
            <box
              key={`${item.issue.key}-${item.isParent ? 'parent' : 'main'}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
                marginLeft: item.isParent ? 2 : 0
              }}
            >
              {item.isParent && (
                <text
                  style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                  wrapMode='none'
                >
                  ↳
                </text>
              )}
              <text
                style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
                wrapMode='none'
              >
                {item.issue.key}
              </text>
              <text
                style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }}
                wrapMode='none'
              >
                {item.issue.fields.status.name}
              </text>
              <text
                style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                wrapMode='none'
              >
                {item.issue.fields.issuetype.name}
              </text>
              <text
                style={{ fg: Colors.PRIMARY }}
                wrapMode='none'
              >
                {item.issue.fields.summary}
              </text>
            </box>
          );
        })}
      </box>

      <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
        ─────────────────────────────────────
      </text>

      {selectedListItem && <JiraIssueInfo issue={selectedListItem.issue} />}
    </box>
  );
}
