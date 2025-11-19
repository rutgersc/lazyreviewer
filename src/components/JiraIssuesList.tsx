import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import JiraIssueInfo from './JiraIssueInfo';
import { Colors } from '../colors';
import type { JiraIssue } from '../jira/jira-schema';
import { ActivePane } from '../userselection/userSelection';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { infoPaneTabAtom, selectedJiraIndexAtom, selectedJiraSubIndexAtom, activeModalAtom } from '../store/appAtoms';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useEffect } from 'react';

interface JiraIssuesListProps {
  activePane: ActivePane;
  jiraIssues: JiraIssue[];
}

type JiraListItem = {
  issue: JiraIssue;
  isParent: boolean;
  parentIssueIndex: number;
  subIndex: number;
};

export default function JiraIssuesList({ activePane, jiraIssues }: JiraIssuesListProps) {
  const activeModal = useAtomValue(activeModalAtom);
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const [selectedJiraIndex, setSelectedJiraIndex] = useAtom(selectedJiraIndexAtom);
  const [selectedJiraSubIndex, setSelectedJiraSubIndex] = useAtom(selectedJiraSubIndexAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

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

  useEffect(() => {
      const item = jiraListItems.find(i => i.parentIssueIndex === selectedJiraIndex && i.subIndex === selectedJiraSubIndex);
      if (item) {
          scrollToId(`jira-item-${item.parentIssueIndex}-${item.subIndex}`);
      }
  }, [selectedJiraIndex, selectedJiraSubIndex]);

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
          const newSub = selectedJiraSubIndex + 1;
          setSelectedJiraSubIndex(newSub);
          scrollToId(`jira-item-${selectedJiraIndex}-${newSub}`);
        } else if (selectedJiraIndex < jiraIssues.length - 1) {
          const newIndex = selectedJiraIndex + 1;
          setSelectedJiraIndex(newIndex);
          scrollToId(`jira-item-${newIndex}-${selectedJiraSubIndex}`);
        }
        break;
      case 'k':
      case 'up':
        if (selectedJiraSubIndex > 0) {
          const newSub = selectedJiraSubIndex - 1;
          setSelectedJiraSubIndex(newSub);
          scrollToId(`jira-item-${selectedJiraIndex}-${newSub}`);
        } else if (selectedJiraIndex > 0) {
          const newIndex = selectedJiraIndex - 1;
          setSelectedJiraIndex(newIndex);
          scrollToId(`jira-item-${newIndex}-${selectedJiraSubIndex}`);
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

  const selectedListItem = jiraListItems.find(
    item => item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex
  );

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        flexGrow: 1,
        width: "100%",
        contentOptions: { backgroundColor: '#282a36' },
        scrollbarOptions: {
          trackOptions: { foregroundColor: '#bd93f9', backgroundColor: '#44475a' },
        },
      }}
    >
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {jiraListItems.map((item) => {
          const isSelected = item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex;

          return (
            <box
              key={`${item.issue.key}-${item.isParent ? 'parent' : 'main'}`}
              id={`jira-item-${item.parentIssueIndex}-${item.subIndex}`}
              onMouseDown={() => {
                setSelectedJiraIndex(item.parentIssueIndex);
                setSelectedJiraSubIndex(item.subIndex);
                scrollToId(`jira-item-${item.parentIssueIndex}-${item.subIndex}`);
              }}
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
    </scrollbox>
  );
}
