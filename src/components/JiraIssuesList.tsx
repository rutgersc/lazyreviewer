import { TextAttributes } from '@opentui/core';
import JiraIssueInfo from './JiraIssueInfo';
import type { Action } from '../actions/action-types';
import { parseKeyString } from '../actions/key-matcher';
import { paneActionsAtom } from '../actions/actions-atom';
import { Colors } from '../colors';
import type { JiraIssue } from '../jira/jira-schema';
import { ActivePane } from '../userselection/userSelection';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { infoPaneTabAtom, activeModalAtom } from '../ui/navigation-atom';
import { selectedJiraIndexAtom, selectedJiraSubIndexAtom, jiraCommentFocusedAtom, selectedJiraCommentIndexAtom } from '../jira/jira-atom';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useRef, useMemo, useEffect } from 'react';
import { useJiraScroll } from '../hooks/useJiraScroll';

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
  const [commentFocused, setCommentFocused] = useAtom(jiraCommentFocusedAtom);
  const [selectedCommentIndex, setSelectedCommentIndex] = useAtom(selectedJiraCommentIndexAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const registeredRef = useRef(false);
  const { registerHandler } = useJiraScroll();

  const handleJiraClick = useDoubleClick<JiraListItem>({
    onSingleClick: (item) => {
      setSelectedJiraIndex(item.parentIssueIndex);
      setSelectedJiraSubIndex(item.subIndex);
      scrollToId(`jira-item-${item.parentIssueIndex}-${item.subIndex}`);
    },
    onDoubleClick: (item) => {
       const jiraBaseUrl = item.issue.self.split('/rest/')[0];
       const jiraUrl = `${jiraBaseUrl}/browse/${item.issue.key}`;
       openUrl(jiraUrl);
    }
  });

  if (!registeredRef.current) {
    console.log('registering handler');
    registeredRef.current = true;
    const handler = ({ issueKey, commentId }: { issueKey: string; commentId?: string }) => {
      if (jiraIssues.length === 0) return;
      const issueIndex = jiraIssues.findIndex(i => i.key === issueKey);
      if (issueIndex < 0) return;
      setSelectedJiraIndex(issueIndex);
      setSelectedJiraSubIndex(0);
      const issue = jiraIssues[issueIndex];
      if (!issue) return;
      scrollToId(`jira-item-${issueIndex}-0`);
      if (commentId) {
        const commentIndex = issue.fields.comment.comments.findIndex(c => c.id === commentId);
        if (commentIndex >= 0) {
          setCommentFocused(true);
          setSelectedCommentIndex(commentIndex);
          scrollToId(`jira-comment-${commentId}`);
        }
      }
    };
    registerHandler(handler);
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

  const setPaneActions = useAtomSet(paneActionsAtom);
  const isActive = activePane === ActivePane.InfoPane && infoPaneTab === 'jira';

  const actions: Action[] = useMemo(() => {
    if (jiraIssues.length === 0) return [];

    const selectedIssue = jiraIssues[selectedJiraIndex];
    const hasParent = selectedIssue?.fields.parent !== undefined;
    const maxSubIndex = hasParent ? 1 : 0;
    const comments = selectedIssue?.fields.comment.comments ?? [];

    // Comment-focused mode actions
    if (commentFocused) {
      return [
        {
          id: 'jira:comment-nav-down',
          keys: [parseKeyString('j'), parseKeyString('down')],
          displayKey: 'j/k, ↑/↓',
          description: 'Navigate comments',
          handler: () => {
            if (selectedCommentIndex < comments.length - 1) {
              const newIndex = selectedCommentIndex + 1;
              setSelectedCommentIndex(newIndex);
              const comment = comments[newIndex];
              if (comment) scrollToId(`jira-comment-${comment.id}`);
            }
          },
        },
        {
          id: 'jira:comment-nav-up',
          keys: [parseKeyString('k'), parseKeyString('up')],
          displayKey: '',
          description: '',
          handler: () => {
            if (selectedCommentIndex > 0) {
              const newIndex = selectedCommentIndex - 1;
              setSelectedCommentIndex(newIndex);
              const comment = comments[newIndex];
              if (comment) scrollToId(`jira-comment-${comment.id}`);
            }
          },
        },
        {
          id: 'jira:exit-comments',
          keys: [parseKeyString('escape')],
          displayKey: 'Esc',
          description: 'Exit comment mode',
          handler: () => {
            setCommentFocused(false);
            setSelectedCommentIndex(0);
          },
        },
        {
          id: 'jira:open-browser',
          keys: [parseKeyString('i')],
          displayKey: 'i',
          description: 'Open issue in browser',
          handler: () => {
            if (selectedIssue) {
              const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
              const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
              openUrl(jiraUrl);
            }
          },
        },
        {
          id: 'jira:copy-url',
          keys: [parseKeyString('c')],
          displayKey: 'c',
          description: 'Copy issue URL',
          handler: () => {
            if (selectedIssue) {
              const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
              const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
              copyToClipboard(jiraUrl);
            }
          },
        },
      ];
    }

    // Issue-level navigation mode actions
    return [
      {
        id: 'jira:nav-down',
        keys: [parseKeyString('j'), parseKeyString('down')],
        displayKey: 'j/k, ↑/↓',
        description: 'Navigate Jira issues',
        handler: () => {
          if (selectedJiraSubIndex < maxSubIndex) {
            const newSub = selectedJiraSubIndex + 1;
            setSelectedJiraSubIndex(newSub);
            scrollToId(`jira-item-${selectedJiraIndex}-${newSub}`);
          } else if (selectedJiraIndex < jiraIssues.length - 1) {
            const newIndex = selectedJiraIndex + 1;
            setSelectedJiraIndex(newIndex);
            setSelectedJiraSubIndex(0);
            setSelectedCommentIndex(0);
            scrollToId(`jira-item-${newIndex}-0`);
          }
        },
      },
      {
        id: 'jira:nav-up',
        keys: [parseKeyString('k'), parseKeyString('up')],
        displayKey: '',
        description: '',
        handler: () => {
          if (selectedJiraSubIndex > 0) {
            const newSub = selectedJiraSubIndex - 1;
            setSelectedJiraSubIndex(newSub);
            scrollToId(`jira-item-${selectedJiraIndex}-${newSub}`);
          } else if (selectedJiraIndex > 0) {
            const newIndex = selectedJiraIndex - 1;
            setSelectedJiraIndex(newIndex);
            const prevIssue = jiraIssues[newIndex];
            const prevMaxSub = prevIssue?.fields.parent ? 1 : 0;
            setSelectedJiraSubIndex(prevMaxSub);
            setSelectedCommentIndex(0);
            scrollToId(`jira-item-${newIndex}-${prevMaxSub}`);
          }
        },
      },
      {
        id: 'jira:enter-comments',
        keys: [parseKeyString('return')],
        displayKey: 'Enter',
        description: 'Enter comment focus mode',
        handler: () => {
          if (comments.length > 0) {
            setCommentFocused(true);
            setSelectedCommentIndex(0);
            const comment = comments[0];
            if (comment) scrollToId(`jira-comment-${comment.id}`);
          }
        },
      },
      {
        id: 'jira:open-browser',
        keys: [parseKeyString('i')],
        displayKey: 'i',
        description: 'Open issue in browser',
        handler: () => {
          if (selectedIssue) {
            const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
            const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
            openUrl(jiraUrl);
          }
        },
      },
      {
        id: 'jira:copy-url',
        keys: [parseKeyString('c')],
        displayKey: 'c',
        description: 'Copy issue URL',
        handler: () => {
          if (selectedIssue) {
            const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
            const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
            copyToClipboard(jiraUrl);
          }
        },
      },
      {
        id: 'jira:reset',
        keys: [parseKeyString('escape')],
        displayKey: 'Esc',
        description: 'Reset selection',
        handler: () => {
          setSelectedJiraIndex(0);
          setSelectedJiraSubIndex(0);
        },
      },
    ];
  }, [jiraIssues, selectedJiraIndex, selectedJiraSubIndex, commentFocused, selectedCommentIndex, scrollToId]);

  useEffect(() => {
    if (isActive && activeModal === 'none') {
      setPaneActions(actions);
    }
  }, [isActive, activeModal, actions, setPaneActions]);
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
              onMouseDown={() => handleJiraClick(item)}
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

      {selectedListItem && <JiraIssueInfo issue={selectedListItem.issue} selectedCommentIndex={selectedCommentIndex} commentFocused={commentFocused} />}
    </box>
    </scrollbox>
  );
}
