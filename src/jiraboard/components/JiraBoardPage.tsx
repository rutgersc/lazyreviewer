import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue, useAtomSet, Result, Atom } from '@effect-atom/atom-react';
import { useMemo, useState } from 'react';
import { Colors } from '../../colors';
import {
  loadSprintsAtom,
  loadSprintIssuesAtom,
  selectedSprintIssuesAtom,
  sprintsStateAtom,
  selectedSprintIdAtom,
  expandedKeysAtom,
  boardSelectedIndexAtom,
  epicLegendVisibleAtom,
  subtasksCollapsedAtom,
  sortOrderAtom,
  sortPopupVisibleAtom,
} from '../atoms';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { openUrl } from '../../system/open-url';
import { copyToClipboard } from '../../system/clipboard';
import JiraBoardSetup from './JiraBoardSetup';
import EpicLegend from './EpicLegend';
import { transformToBoard, flattenBoard, mapStatus, mapPriority, sortStories } from '../board-utils';

interface JiraBoardPageProps {
  onClose: () => void;
  boardId: number | undefined;
}

const getIssueTypeIcon = (issueType: string): string => {
  const type = issueType.toLowerCase();
  if (type === 'bug') return '🪲';
  if (type === 'story') return '📖';
  if (type === 'task') return '✓ ';
  if (type === 'sub-task' || type === 'subtask') return '⇄ ';
  if (type === 'epic') return '⚡';
  return '• ';
};

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

const SORT_OPTIONS: Array<{ key: 'default' | 'epic' | 'priority'; label: string }> = [
  { key: 'default', label: 'Default (Board Order)' },
  { key: 'epic', label: 'By Epic' },
  { key: 'priority', label: 'By Priority' },
];

export default function JiraBoardPage({ onClose, boardId }: JiraBoardPageProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState(boardId);
  const [sortSelectedIndex, setSortSelectedIndex] = useState(0);

  const loadSprintsResult = useAtomValue(loadSprintsAtom);
  const loadSprintIssuesResult = useAtomValue(loadSprintIssuesAtom);

  const loadSprints = useAtomSet(loadSprintsAtom);
  const loadSprintIssues = useAtomSet(loadSprintIssuesAtom);
  const setSelectedIndex = useAtomSet(boardSelectedIndexAtom);
  const setExpandedKeys = useAtomSet(expandedKeysAtom);
  const setSelectedSprintId = useAtomSet(selectedSprintIdAtom);
  const setEpicLegendVisible = useAtomSet(epicLegendVisibleAtom);
  const setSubtasksCollapsed = useAtomSet(subtasksCollapsedAtom);
  const setSortOrder = useAtomSet(sortOrderAtom);
  const setSortPopupVisible = useAtomSet(sortPopupVisibleAtom);

  const sprintsResult = useAtomValue(sprintsStateAtom);
  const sprints = Result.builder(sprintsResult)
    .onSuccess((state) => state._type === 'SprintsState' ? state.sprints : [])
    .orElse(() => []);

  const selectedSprintId = useAtomValue(selectedSprintIdAtom);
  const selectedSprint = useAtomValue(selectedSprintAtom);
  const issues = useAtomValue(selectedSprintIssuesAtom);
  const hasIssuesForSelectedSprint = issues.length > 0;

  const selectedIndex = useAtomValue(boardSelectedIndexAtom);
  const epicLegendVisible = useAtomValue(epicLegendVisibleAtom);
  const subtasksCollapsed = useAtomValue(subtasksCollapsedAtom);
  const sortOrder = useAtomValue(sortOrderAtom);
  const sortPopupVisible = useAtomValue(sortPopupVisibleAtom);

  const { stories, flatItems, epicColors } = useMemo(() => {
    const rawStories = transformToBoard(issues);
    const sortedStories = sortStories(rawStories, sortOrder);
    const flatItems = flattenBoard(sortedStories, subtasksCollapsed);
    const epicColors = new Map(sortedStories.map(s => [s.issue.key, s.epicColor]));
    return { stories: sortedStories, flatItems, epicColors };
  }, [issues, sortOrder, subtasksCollapsed]);

  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const isLoadingSprints = Result.isWaiting(loadSprintsResult);
  const isLoadingIssues = Result.isWaiting(loadSprintIssuesResult);
  const sprintsError = Result.isFailure(loadSprintsResult) ? String(loadSprintsResult.cause) : null;
  const issuesError = Result.isFailure(loadSprintIssuesResult) ? String(loadSprintIssuesResult.cause) : null;

  const noSprintsLoaded = Result.builder(sprintsResult)
    .onSuccess((state) => state._type === 'NoSprintsState')
    .orElse(() => true);

  const selectedItem = flatItems[selectedIndex];

  const handleSprintChange = (sprintId: number) => {
    setSelectedIndex(0);
    setExpandedKeys(new Set());
    setSelectedSprintId(sprintId);
  };

  const handleItemClick = (index: number) => {
    setSelectedIndex(index);
    const item = flatItems[index];
    if (item) scrollToId(`board-item-${item.storyIndex}-${item.itemIndex}`);
  };

  useKeyboard((key: ParsedKey) => {
    if (sortPopupVisible) {
      switch (key.name) {
        case 'escape':
        case 'q':
          setSortPopupVisible(false);
          break;
        case 'j':
        case 'down':
          setSortSelectedIndex(prev => Math.min(prev + 1, SORT_OPTIONS.length - 1));
          break;
        case 'k':
        case 'up':
          setSortSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'return':
          const option = SORT_OPTIONS[sortSelectedIndex];
          if (option) {
            setSortOrder(option.key);
            setSortPopupVisible(false);
          }
          break;
      }
      return;
    }

    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'j':
      case 'down':
        if (selectedIndex < flatItems.length - 1) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          const item = flatItems[newIndex];
          if (item) scrollToId(`board-item-${item.storyIndex}-${item.itemIndex}`);
        }
        break;
      case 'k':
      case 'up':
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          const item = flatItems[newIndex];
          if (item) scrollToId(`board-item-${item.storyIndex}-${item.itemIndex}`);
        }
        break;
      case 'e':
        setEpicLegendVisible(!epicLegendVisible);
        break;
      case 'x':
        setSubtasksCollapsed(!subtasksCollapsed);
        setSelectedIndex(0);
        break;
      case 'O':
        setSortPopupVisible(true);
        setSortSelectedIndex(SORT_OPTIONS.findIndex(o => o.key === sortOrder));
        break;
      case 'o':
      case 'i': {
        const item = flatItems[selectedIndex];
        if (item) {
          const baseUrl = process.env.JIRA_BASE_URL || 'https://scisure.atlassian.net';
          openUrl(`${baseUrl}/browse/${item.item.key}`);
        }
        break;
      }
      case 'c': {
        const item = flatItems[selectedIndex];
        if (item) {
          const baseUrl = process.env.JIRA_BASE_URL || 'https://scisure.atlassian.net';
          copyToClipboard(`${baseUrl}/browse/${item.item.key}`);
        }
        break;
      }
      case 'y': {
        const item = flatItems[selectedIndex];
        if (item) {
          copyToClipboard(item.item.key);
        }
        break;
      }
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

  const renderList = () => {
    return flatItems.map((flatItem, index) => {
      const { story, item } = flatItem;
      const isSelected = index === selectedIndex;
      const status = mapStatus(item.fields.status.name);
      const icon = getIssueTypeIcon(item.fields.issuetype.name);
      const parentType = item.fields.parent?.fields.issuetype.name.toLowerCase();
      const isTopLevel = !item.fields.parent || parentType === 'epic';
      const statusPadded = status.text.padEnd(4);
      const epicName = parentType === 'epic' ? item.fields.parent?.fields.summary : null;
      const epicLabel = isTopLevel
        ? (epicName ?? 'no epic assigned').slice(0, 20).padEnd(20)
        : ''.padEnd(20);
      const keyPadded = item.key.padEnd(12);
      const priority = isTopLevel ? mapPriority(item.fields.priority.name) : null;
      const greyedOut = status.isMerged;

      const rowColor = greyedOut ? Colors.SUPPORTING : Colors.PRIMARY;
      const keyColor = greyedOut ? Colors.SUPPORTING : (isTopLevel ? Colors.SUCCESS : Colors.INFO);

      return (
        <box
          key={item.key}
          id={`board-item-${flatItem.storyIndex}-${flatItem.itemIndex}`}
          onMouseDown={() => handleItemClick(index)}
          style={{
            flexDirection: 'row',
            gap: 1,
            backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
          }}
        >
          {isTopLevel
            ? <text style={{ fg: greyedOut ? Colors.SUPPORTING : (epicName ? story.epicColor : Colors.SUPPORTING) }} wrapMode="none">{epicLabel}</text>
            : <text wrapMode="none">{epicLabel}</text>
          }
          {isTopLevel && priority && (
            <text style={{ fg: greyedOut ? Colors.SUPPORTING : priority.color }} wrapMode="none">●</text>
          )}
          {!isTopLevel && <text wrapMode="none"> </text>}
          <text style={{ fg: greyedOut ? Colors.SUPPORTING : status.color }} wrapMode="none">{statusPadded}</text>
          <text style={{ fg: greyedOut ? Colors.SUPPORTING : Colors.NEUTRAL }} wrapMode="none">{icon}</text>
          <text style={{ fg: keyColor, attributes: isTopLevel && !greyedOut ? TextAttributes.BOLD : undefined }} wrapMode="none">{keyPadded}</text>
          <text style={{ fg: rowColor, flexShrink: 1 }} wrapMode="none">{item.fields.summary}</text>
        </box>
      );
    });
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
              wrapMode="none"
            >
              {isActive ? '▸ ' : '  '}{sprint.name}
            </text>
          );
        })}
      </box>
    );
  };

  const renderSortPopup = () => {
    if (!sortPopupVisible) return null;

    return (
      <box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <box
          style={{
            borderStyle: 'single',
            borderColor: Colors.SUCCESS,
            backgroundColor: Colors.BACKGROUND,
            flexDirection: 'column',
            padding: 1,
          }}
        >
          <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode="none">
            Sort Order
          </text>
          {SORT_OPTIONS.map((option, index) => (
            <box
              key={option.key}
              style={{
                backgroundColor: index === sortSelectedIndex ? Colors.TRACK : undefined,
              }}
            >
              <text
                style={{
                  fg: index === sortSelectedIndex ? Colors.PRIMARY : Colors.NEUTRAL,
                  attributes: index === sortSelectedIndex ? TextAttributes.BOLD : undefined,
                }}
                wrapMode="none"
              >
                {sortOrder === option.key ? '● ' : '  '}{option.label}
              </text>
            </box>
          ))}
        </box>
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
      <box style={{ flexDirection: 'column' }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode="none">
            ✦ Sprint Board {selectedSprint ? `- ${selectedSprint.name}` : ''} {subtasksCollapsed ? '[collapsed]' : ''}
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode="none">
            q: close | S: board | r: sprints | f: fetch | x: collapse | O: sort | o: open | y: copy key
          </text>
        </box>
        {renderSprintTabs()}
      </box>

      {isLoadingSprints && (
        <text style={{ fg: Colors.INFO }} wrapMode="none">Loading sprints...</text>
      )}

      {isLoadingIssues && (
        <text style={{ fg: Colors.INFO }} wrapMode="none">Loading issues...</text>
      )}

      {sprintsError && (
        <text style={{ fg: Colors.ERROR }} wrapMode="none">Error: {sprintsError}</text>
      )}

      {issuesError && (
        <text style={{ fg: Colors.ERROR }} wrapMode="none">Error: {issuesError}</text>
      )}

      {!isLoadingSprints && !sprintsError && noSprintsLoaded && (
        <text style={{ fg: Colors.NEUTRAL }} wrapMode="none">Press 'r' to load sprints</text>
      )}

      {!isLoadingSprints && !sprintsError && !noSprintsLoaded && sprints.length === 0 && (
        <text style={{ fg: Colors.NEUTRAL }} wrapMode="none">No active sprints found</text>
      )}

      {!isLoadingIssues && !issuesError && sprints.length > 0 && selectedSprintId && !hasIssuesForSelectedSprint && (
        <text style={{ fg: Colors.NEUTRAL }} wrapMode="none">Press 'f' to fetch issues for this sprint</text>
      )}

      {!isLoadingSprints && !isLoadingIssues && flatItems.length > 0 && (
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
            {renderList()}
          </box>
        </scrollbox>
      )}

      {epicLegendVisible && (
        <EpicLegend epicColors={epicColors} onClose={() => setEpicLegendVisible(false)} />
      )}

      {renderSortPopup()}
    </box>
  );
}
