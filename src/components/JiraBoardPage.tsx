import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue, useAtomSet, Result, Atom } from '@effect-atom/atom-react';
import { useMemo, useState } from 'react';
import { Colors } from '../colors';
import {
  loadSprintsAtom,
  loadSprintIssuesAtom,
  selectedSprintIssuesAtom,
  sprintsStateAtom,
} from '../jira/jira-sprint-atom';
import type { JiraIssue } from '../jira/jira-schema';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import JiraBoardSetup from './JiraBoardSetup';

interface JiraBoardPageProps {
  onClose: () => void;
  boardId: number | undefined;
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

const selectedIssueIndexAtom = Atom.make<number>(0);
export const expandedKeysAtom = Atom.make<Set<string>>(new Set<string>());
export const selectedSprintIdAtom = Atom.make<number | null>(null);

const selectedSprintAtom = Atom.readable((get) => {
  const sprintsResult = get(sprintsStateAtom);
  const selectedId = get(selectedSprintIdAtom);

  return Result.builder(sprintsResult)
    .onSuccess((state) => {
      if (state._type === 'NoSprintsState') return null;
      return state.sprints.find((s) => s.id === selectedId) ?? null;
    })
    .orElse(() => null);
});

const toggleExpandAtom = Atom.writable(
  (get) => get(expandedKeysAtom),
  (ctx, key: string) => {
    const prev = ctx.get(expandedKeysAtom);
    const newExpanded = new Set<string>(prev);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    ctx.set(expandedKeysAtom, newExpanded);
  }
);

type FlatListItem = {
  type: "parent" | "child";
  key: string;
  issue: JiraIssue;
  childCount: number;
};

export default function JiraBoardPage({ onClose, boardId }: JiraBoardPageProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState(boardId);

  // Action results for loading UI
  const loadSprintsResult = useAtomValue(loadSprintsAtom);
  const loadSprintIssuesResult = useAtomValue(loadSprintIssuesAtom);

  // Actions
  const loadSprints = useAtomSet(loadSprintsAtom);
  const loadSprintIssues = useAtomSet(loadSprintIssuesAtom);
  const toggleExpand = useAtomSet(toggleExpandAtom);
  const setSelectedIssueIndex = useAtomSet(selectedIssueIndexAtom);
  const setExpandedKeys = useAtomSet(expandedKeysAtom);
  const setSelectedSprintId = useAtomSet(selectedSprintIdAtom);

  // Data (Projected)
  const sprintsResult = useAtomValue(sprintsStateAtom);
  const sprints = Result.builder(sprintsResult)
    .onSuccess((state) => state._type === 'SprintsState' ? state.sprints : [])
    .orElse(() => []);

  const selectedSprintId = useAtomValue(selectedSprintIdAtom);
  const selectedSprint = useAtomValue(selectedSprintAtom);
  const issues = useAtomValue(selectedSprintIssuesAtom);
  const hasIssuesForSelectedSprint = issues.length > 0;

  // UI State
  const selectedIssueIndex = useAtomValue(selectedIssueIndexAtom);
  const expandedKeys = useAtomValue(expandedKeysAtom);

  // Build flat list from issues - parents first, then children if expanded
  const flattenedList = useMemo(() => {
    const items: FlatListItem[] = [];

    // Group issues: parents (no parent field) and children (have parent field)
    const parents = issues.filter(issue => !issue.fields.parent);
    const childrenByParentKey = new Map<string, JiraIssue[]>();

    issues.forEach(issue => {
      if (issue.fields.parent) {
        const parentKey = issue.fields.parent.key;
        const existing = childrenByParentKey.get(parentKey) ?? [];
        existing.push(issue);
        childrenByParentKey.set(parentKey, existing);
      }
    });

    parents.forEach(parent => {
      const children = childrenByParentKey.get(parent.key) ?? [];
      items.push({
        type: "parent",
        key: parent.key,
        issue: parent,
        childCount: children.length,
      });

      if (expandedKeys.has(parent.key)) {
        children.forEach(child => {
          items.push({
            type: "child",
            key: child.key,
            issue: child,
            childCount: 0,
          });
        });
      }
    });

    return items;
  }, [issues, expandedKeys]);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const isLoadingSprints = Result.isWaiting(loadSprintsResult);
  const isLoadingIssues = Result.isWaiting(loadSprintIssuesResult);
  const sprintsError = Result.isFailure(loadSprintsResult) ? String(loadSprintsResult.cause) : null;
  const issuesError = Result.isFailure(loadSprintIssuesResult) ? String(loadSprintIssuesResult.cause) : null;

  const noSprintsLoaded = Result.builder(sprintsResult)
    .onSuccess((state) => state._type === 'NoSprintsState')
    .orElse(() => true);

  const selectedItem = flattenedList[selectedIssueIndex];

  const handleSprintChange = (sprintId: number) => {
    // Clearing selection/tree state before switching
    setSelectedIssueIndex(0);
    setExpandedKeys(new Set());
    // The derived sprintTreeAtom will automatically show cached data if available
    // If not cached, the fetch logic above will trigger a fetch
    setSelectedSprintId(sprintId);
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
        if (currentBoardId) loadSprints(currentBoardId);
        break;
      case 'f':
        if (selectedSprintId && currentBoardId) {
          loadSprintIssues({ sprintId: selectedSprintId, boardId: currentBoardId });
        }
        break;
      case 's':
      case 'S':
        setShowSetup(true);
        break;
      case 'h':
      case 'left':
        if (sprints.length > 0) {
          if (selectedSprintId === null) {
            handleSprintChange(sprints[0]!.id);
          } else {
            const currentIndex = sprints.findIndex(s => s.id === selectedSprintId);
            if (currentIndex > 0) {
              handleSprintChange(sprints[currentIndex - 1]!.id);
            }
          }
        }
        break;
      case 'l':
      case 'right':
        if (sprints.length > 0) {
          if (selectedSprintId === null) {
            handleSprintChange(sprints[0]!.id);
          } else {
            const nextIndex = sprints.findIndex(s => s.id === selectedSprintId);
            if (nextIndex >= 0 && nextIndex < sprints.length - 1) {
              handleSprintChange(sprints[nextIndex + 1]!.id);
            }
          }
        }
        break;
    }
  });

  const renderItem = (item: FlatListItem, index: number) => {
    const isSelected = index === selectedIssueIndex;
    const isExpanded = expandedKeys.has(item.key);
    const issue = item.issue;
    const statusColor = getStatusColor(issue.fields.status.name);

    if (item.type === 'parent') {
      const expandIcon = item.childCount > 0 ? (isExpanded ? '▾' : '▸') : ' ';

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
          {item.childCount > 0 && (
            <text style={{ fg: Colors.INFO }} wrapMode='none'>
              ⊙ {item.childCount}
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
          └─
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

  if (!currentBoardId || showSetup) {
    return (
      <JiraBoardSetup
        onClose={() => currentBoardId ? setShowSetup(false) : onClose()}
        onBoardSelected={(id) => {
          setCurrentBoardId(id);
          setShowSetup(false);
        }}
        currentBoardId={currentBoardId}
      />
    );
  }

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
          q: close | S: switch board | r: sprints | f: issues | h/l: sprint | j/k: nav | o: open
        </text>
        </box>
        {renderSprintTabs()}
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>
      </box>

      {isLoadingSprints && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Loading sprints...
          </text>
        </box>
      )}

      {isLoadingIssues && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Loading issues...
          </text>
        </box>
      )}

      {sprintsError && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {sprintsError}
          </text>
        </box>
      )}

      {issuesError && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {issuesError}
          </text>
        </box>
      )}

      {!isLoadingSprints && !sprintsError && noSprintsLoaded && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Press 'r' to load sprints
          </text>
        </box>
      )}

      {!isLoadingSprints && !sprintsError && !noSprintsLoaded && sprints.length === 0 && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            No active sprints found
          </text>
        </box>
      )}

      {!isLoadingIssues && !issuesError && sprints.length > 0 && selectedSprintId && !hasIssuesForSelectedSprint && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Press 'f' to fetch issues for this sprint
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
