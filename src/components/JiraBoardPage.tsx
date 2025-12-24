import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue, useAtomSet, Result } from '@effect-atom/atom-react';
import { useEffect } from 'react';
import { Colors } from '../colors';
import {
  loadSprintsAtom,
  sprintsAtom,
  boardIdAtom,
  selectedSprintIdAtom,
  selectedSprintAtom,
  loadSprintIssuesAtom,
  sprintTreeAtom,
  hasIssuesForSelectedSprintAtom,
  selectedIssueIndexAtom,
  expandedKeysAtom,
  toggleExpandAtom,
  flattenedListAtom,
  selectSprintAtom,
  type FlatListItem,
} from '../jira/jira-sprint-atom';
import type { JiraIssue } from '../jira/jira-schema';
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
  // Action results for loading UI
  const loadSprintsResult = useAtomValue(loadSprintsAtom);
  const loadSprintIssuesResult = useAtomValue(loadSprintIssuesAtom);

  // Actions
  const loadSprints = useAtomSet(loadSprintsAtom);
  const loadSprintIssues = useAtomSet(loadSprintIssuesAtom);
  const selectSprint = useAtomSet(selectSprintAtom);
  const toggleExpand = useAtomSet(toggleExpandAtom);
  const setSelectedIssueIndex = useAtomSet(selectedIssueIndexAtom);
  const setExpandedKeys = useAtomSet(expandedKeysAtom);

  // Data (Projected)
  const sprints = useAtomValue(sprintsAtom);
  const storedBoardId = useAtomValue(boardIdAtom);
  const selectedSprintId = useAtomValue(selectedSprintIdAtom);
  const selectedSprint = useAtomValue(selectedSprintAtom);
  const tree = useAtomValue(sprintTreeAtom);
  const hasIssuesForSelectedSprint = useAtomValue(hasIssuesForSelectedSprintAtom);

  // UI State
  const selectedIssueIndex = useAtomValue(selectedIssueIndexAtom);
  const expandedKeys = useAtomValue(expandedKeysAtom);
  const flattenedList = useAtomValue(flattenedListAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const isLoadingSprints = Result.isInitial(loadSprintsResult) || Result.isWaiting(loadSprintsResult);
  const isLoadingIssues = Result.isWaiting(loadSprintIssuesResult);
  const sprintsError = Result.isFailure(loadSprintsResult) ? String(loadSprintsResult.cause) : null;
  const issuesError = Result.isFailure(loadSprintIssuesResult) ? String(loadSprintIssuesResult.cause) : null;

  // Trigger initial sprints load
  if (Result.isInitial(loadSprintsResult)) {
    loadSprints(boardId);
  }

  // Only fetch issues if we don't have cached data for the selected sprint
  if (Result.isSuccess(loadSprintsResult) && selectedSprintId && !hasIssuesForSelectedSprint && !Result.isWaiting(loadSprintIssuesResult)) {
    loadSprintIssues({ sprintId: selectedSprintId, boardId });
  }

  // When issues load, expand all parent keys automatically if none expanded
    if (Result.isSuccess(loadSprintIssuesResult) && tree.length > 0 && expandedKeys.size === 0) {
      setExpandedKeys(new Set(tree.map(node => node.issue.key)));
    }

  const selectedItem = flattenedList[selectedIssueIndex];

  const handleSprintChange = (sprintId: number) => {
    if (storedBoardId === null) return;
    // Clearing selection/tree state before switching
    setSelectedIssueIndex(0);
    setExpandedKeys(new Set());
    // Trigger action to append selection event
    // The derived sprintTreeAtom will automatically show cached data if available
    // If not cached, the fetch logic above will trigger a fetch
    selectSprint({ sprintId, boardId: storedBoardId });
  };

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'j':
      case 'down':
        if (selectedIssueIndex < flattenedList.length - 1) {
          const newIndex = selectedIssueIndex + 1;
          setSelectedIssueIndex(newIndex);
          const item = flattenedList[newIndex];
          if (item) scrollToId(`jira-board-${item.key}`);
        }
        break;
      case 'k':
      case 'up':
        if (selectedIssueIndex > 0) {
          const newIndex = selectedIssueIndex - 1;
          setSelectedIssueIndex(newIndex);
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
        loadSprints(boardId);
        break;
      case 'h':
      case 'left':
        const currentIndex = sprints.findIndex(s => s.id === selectedSprintId);
        if (currentIndex > 0) {
          handleSprintChange(sprints[currentIndex - 1]!.id);
        }
        break;
      case 'l':
      case 'right':
        const nextIndex = sprints.findIndex(s => s.id === selectedSprintId);
        if (nextIndex >= 0 && nextIndex < sprints.length - 1) {
          handleSprintChange(sprints[nextIndex + 1]!.id);
        }
        break;
    }
  });

  const renderItem = (item: FlatListItem, index: number) => {
    const isSelected = index === selectedIssueIndex;
    const isExpanded = expandedKeys.has(item.key);

    if (item.type === 'parent') {
      const issue = item.issue as JiraIssue;
      const childCount = tree.find(n => n.issue.key === item.key)?.children.length ?? 0;
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

    const issue = item.issue as JiraIssue;
    const statusColor = getStatusColor(issue.fields.status.name);
    const treeChar = item.level > 0 ? '└─' : '';
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

  const renderSprintTabs = () => {
    if (sprints.length <= 1) return null;

    return (
      <box style={{ flexDirection: 'row', gap: 2, marginBottom: 1 }}>
        {sprints.map((sprint) => {
          const isActive = sprint.id === selectedSprintId;
          return (
            <text
              key={sprint.id}
              style={{
                fg: isActive ? Colors.SUCCESS : Colors.NEUTRAL,
                attributes: isActive ? TextAttributes.BOLD : undefined,
              }}
              wrapMode='none'
            >
              {isActive ? '▸ ' : '  '}{sprint.name}
            </text>
          );
        })}
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
          ✦ Jira Board {selectedSprint ? `- ${selectedSprint.name}` : ''}
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          q: close | j/k: nav | h/l: sprint | Enter: expand | o: open | r: refresh
        </text>
        </box>
        {renderSprintTabs()}
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>
      </box>

      {(isLoadingSprints || isLoadingIssues) && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            {isLoadingSprints ? 'Loading sprints...' : 'Loading issues...'}
          </text>
        </box>
      )}

      {(sprintsError || issuesError) && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {sprintsError || issuesError}
          </text>
        </box>
      )}

      {!isLoadingSprints && !isLoadingIssues && !sprintsError && !issuesError && sprints.length === 0 && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            No active sprints found
          </text>
        </box>
      )}

      {!isLoadingSprints && !isLoadingIssues && !sprintsError && !issuesError && flattenedList.length === 0 && sprints.length > 0 && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            No issues in selected sprint
          </text>
        </box>
      )}

      {!isLoadingSprints && !isLoadingIssues && flattenedList.length > 0 && (
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
