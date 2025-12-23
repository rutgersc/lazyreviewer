import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { Colors } from '../colors';
import {
  jiraSprintBoardAtom,
  loadSprintBoardAtom,
  toggleExpandAtom,
  setSelectedIndexAtom,
  flattenedListAtom,
  type FlatListItem,
} from '../jira/jira-sprint-atom';
import type { JiraSprintIssue } from '../jira/jira-sprint-schema';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';

interface JiraBoardPageProps {
  onClose: () => void;
  boardId: number;
}

const getIssueTypeIcon = (issueType: string): string => {
  const type = issueType.toLowerCase();
  if (type === 'bug') return '🪲';
  if (type === 'story') return '📖';
  if (type === 'task') return '✓';
  if (type === 'sub-task' || type === 'subtask') return '⇄';
  if (type === 'epic') return '⚡';
  return '•';
};

const getStatusColor = (status: string): string => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'done' || lowerStatus === 'merged') return Colors.SUCCESS;
  if (lowerStatus.includes('progress')) return Colors.WARNING;
  if (lowerStatus.includes('qa') || lowerStatus.includes('test')) return Colors.WARNING;
  if (lowerStatus.includes('review')) return Colors.WARNING;
  if (lowerStatus.includes('ready') || lowerStatus.includes('available')) return Colors.NEUTRAL;
  if (lowerStatus === 'to do' || lowerStatus === 'todo') return Colors.INFO;
  if (lowerStatus === 'cancelled' || lowerStatus === 'canceled') return Colors.ERROR;
  return Colors.PRIMARY;
};

export default function JiraBoardPage({ onClose, boardId }: JiraBoardPageProps) {
  const state = useAtomValue(jiraSprintBoardAtom);
  const loadSprintBoard = useAtomSet(loadSprintBoardAtom);
  const toggleExpand = useAtomSet(toggleExpandAtom);
  const setSelectedIndex = useAtomSet(setSelectedIndexAtom);
  const flattenedList = useAtomValue(flattenedListAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadSprintBoard(boardId);
    }
  }, [boardId, loadSprintBoard]);

  const selectedItem = flattenedList[state.selectedIndex];

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'j':
      case 'down':
        if (state.selectedIndex < flattenedList.length - 1) {
          const newIndex = state.selectedIndex + 1;
          setSelectedIndex(newIndex);
          const item = flattenedList[newIndex];
          if (item) scrollToId(`jira-board-${item.key}`);
        }
        break;
      case 'k':
      case 'up':
        if (state.selectedIndex > 0) {
          const newIndex = state.selectedIndex - 1;
          setSelectedIndex(newIndex);
          const item = flattenedList[newIndex];
          if (item) scrollToId(`jira-board-${item.key}`);
        }
        break;
      case 'return':
      case 'space':
        if (selectedItem?.type === 'parent') {
          toggleExpand(selectedItem.key);
        }
        break;
      case 'o':
      case 'i':
        if (selectedItem) {
          const baseUrl = process.env.JIRA_BASE_URL || 'https://scisure.atlassian.net';
          openUrl(`${baseUrl}/browse/${selectedItem.key}`);
        }
        break;
      case 'c':
        if (selectedItem) {
          const baseUrl = process.env.JIRA_BASE_URL || 'https://scisure.atlassian.net';
          copyToClipboard(`${baseUrl}/browse/${selectedItem.key}`);
        }
        break;
      case 'r':
        loadSprintBoard(boardId);
        break;
    }
  });

  const renderItem = (item: FlatListItem, index: number) => {
    const isSelected = index === state.selectedIndex;
    const isExpanded = state.expandedKeys.has(item.key);

    if (item.type === 'parent') {
      const issue = item.issue as JiraSprintIssue;
      const childCount = state.tree.find(n => n.issue.key === item.key)?.children.length ?? 0;
      const statusColor = getStatusColor(issue.fields.status.name);
      const expandIcon = childCount > 0 ? (isExpanded ? '▾' : '▸') : ' ';

      return (
        <box
          key={item.key}
          id={`jira-board-${item.key}`}
          style={{
            flexDirection: 'row',
            backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
            gap: 1,
          }}
        >
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            {expandIcon}
          </text>
          <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {item.key}
          </text>
          <text style={{ fg: Colors.PRIMARY, flexShrink: 1 }} wrapMode='none'>
            {issue.fields.summary.slice(0, 50)}{issue.fields.summary.length > 50 ? '...' : ''}
          </text>
          {childCount > 0 && (
            <text style={{ fg: Colors.INFO }} wrapMode='none'>
              ⊙ {childCount}
            </text>
          )}
          <text
            style={{
              fg: statusColor,
              attributes: issue.fields.status.name.toLowerCase() === 'cancelled' ? TextAttributes.STRIKETHROUGH : undefined,
            }}
            wrapMode='none'
          >
            {issue.fields.status.name.toUpperCase()}
          </text>
        </box>
      );
    }

    const issue = item.issue as JiraSprintIssue;
    const statusColor = getStatusColor(issue.fields.status.name);
    const treeChar = item.isLastChild ? '└─' : '├─';
    const icon = getIssueTypeIcon(issue.fields.issuetype.name);
    const assignee = issue.fields.assignee?.displayName ?? 'Unassigned';

    return (
      <box
        key={item.key}
        id={`jira-board-${item.key}`}
        style={{
          flexDirection: 'row',
          backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
          gap: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {treeChar}
        </text>
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {icon}
        </text>
        <text style={{ fg: Colors.INFO }} wrapMode='none'>
          {item.key}
        </text>
        <text style={{ fg: Colors.PRIMARY, flexShrink: 1 }} wrapMode='none'>
          {issue.fields.summary.slice(0, 45)}{issue.fields.summary.length > 45 ? '...' : ''}
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          ♦ {assignee.split(' ')[0]}
        </text>
        <text
          style={{
            fg: statusColor,
            attributes: issue.fields.status.name.toLowerCase() === 'cancelled' ? TextAttributes.STRIKETHROUGH : undefined,
          }}
          wrapMode='none'
        >
          {issue.fields.status.name}
        </text>
      </box>
    );
  };

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.BACKGROUND,
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <box
        style={{
          flexDirection: 'column',
          padding: 1,
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          ✦ Jira Board {state.sprint ? `- ${state.sprint.name}` : ''}
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          q/Esc: close | j/k: navigate | Enter: expand | o: open | c: copy | r: refresh
        </text>
        </box>
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>
      </box>

      {state.isLoading && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Loading sprint board...
          </text>
        </box>
      )}

      {state.error && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {state.error}
          </text>
        </box>
      )}

      {!state.isLoading && !state.error && flattenedList.length === 0 && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            No issues in active sprint
          </text>
        </box>
      )}

      {!state.isLoading && flattenedList.length > 0 && (
        <scrollbox
          ref={scrollBoxRef}
          style={{
            flexGrow: 1,
            contentOptions: { backgroundColor: Colors.BACKGROUND },
            scrollbarOptions: {
              trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
            },
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            {flattenedList.map((item, index) => renderItem(item, index))}
          </box>
        </scrollbox>
      )}
    </box>
  );
}
