import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue, useAtomSet, Result, Atom } from '@effect-atom/atom-react';
import { sprintFilterAtom, setSprintFilterAtom } from '../../settings/settings-atom';
import { useMemo, useRef, useState } from 'react';
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
  goalVisibleAtom,
  mrsByJiraKeyAtom,
  jiraBoardFocusKeyAtom,
} from '../atoms';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { openUrl } from '../../system/open-url';
import { copyToClipboard } from '../../system/clipboard';
import { getJiraBaseUrl } from '../../jira/jira-common';
import JiraBoardSetup from './JiraBoardSetup';
import EpicLegend from './EpicLegend';
import { transformToBoard, flattenBoard, mapStatus, mapPriority, sortStories, type CollapseState } from '../board-utils';
import { selectMrByIdAtom } from '../../mergerequests/mergerequests-atom';
import type { MergeRequest } from '../../mergerequests/mergerequest-schema';

interface JiraBoardPageProps {
  onClose: () => void;
  boardId: number | undefined;
}

const getIssueTypeIcon = (issueType: string): string => {
  const type = issueType.toLowerCase();
  if (type === 'bug') return '🪲';
  if (type === 'story') return '📖';
  if (type === 'task') return '✓ ';
  if (type === 'sub-task' || type === 'subtask') return '  ';
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
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mrPickerMrs, setMrPickerMrs] = useState<readonly MergeRequest[]>([]);
  const [mrPickerIndex, setMrPickerIndex] = useState(0);

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
  const setGoalVisible = useAtomSet(goalVisibleAtom);
  const selectMrById = useAtomSet(selectMrByIdAtom);
  const setFocusKey = useAtomSet(jiraBoardFocusKeyAtom);

  const sprintFilter = useAtomValue(sprintFilterAtom);
  const setSprintFilter = useAtomSet(setSprintFilterAtom);

  const mrsByJiraKey = useAtomValue(mrsByJiraKeyAtom);

  const sprintsResult = useAtomValue(sprintsStateAtom);
  const sprints = Result.builder(sprintsResult)
    .onSuccess((state) => state._type === 'SprintsState' ? state.sprints : [])
    .orElse(() => []);

  const selectedSprintId = useAtomValue(selectedSprintIdAtom);
  const selectedSprint = useAtomValue(selectedSprintAtom);
  const issues = useAtomValue(selectedSprintIssuesAtom);
  const hasIssuesForSelectedSprint = issues.length > 0;

  if (selectedSprintId === null && sprints.length > 0) {
    setSelectedSprintId(sprints[0]!.id);
  }

  const selectedIndex = useAtomValue(boardSelectedIndexAtom);
  const epicLegendVisible = useAtomValue(epicLegendVisibleAtom);
  const subtasksCollapsed = useAtomValue(subtasksCollapsedAtom);
  const sortOrder = useAtomValue(sortOrderAtom);
  const sortPopupVisible = useAtomValue(sortPopupVisibleAtom);
  const goalVisible = useAtomValue(goalVisibleAtom);

  const { stories, flatItems, epicColors } = useMemo(() => {
    const rawStories = transformToBoard(issues);
    const sortedStories = sortStories(rawStories, sortOrder);
    const flatItems = flattenBoard(sortedStories, subtasksCollapsed, mrsByJiraKey);
    const epicColors = new Map(sortedStories.map(s => [s.issue.key, s.epicColor]));
    return { stories: sortedStories, flatItems, epicColors };
  }, [issues, sortOrder, subtasksCollapsed, mrsByJiraKey]);

  const focusKey = useAtomValue(jiraBoardFocusKeyAtom);
  const focusAppliedRef = useRef(false);

  if (focusKey && flatItems.length > 0 && !focusAppliedRef.current) {
    focusAppliedRef.current = true;
    const matchIdx = flatItems.findIndex(fi => fi.type === 'issue' && fi.item.key === focusKey);
    if (matchIdx >= 0) {
      setSelectedIndex(matchIdx);
    }
    setFocusKey(null);
  }

  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const scrollToItem = (idx: number) => {
    const fi = flatItems[idx];
    if (!fi) return;
    scrollToId(fi.type === 'detail' ? `board-detail-${idx}` : `board-item-${fi.storyIndex}-${fi.itemIndex}`);
  };

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

  const lastClickRef = useRef<{ index: number; time: number }>({ index: -1, time: 0 });

  const handleItemClick = (index: number) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last.index === index && now - last.time < 400) {
      const clickedItem = flatItems[index];
      if (clickedItem?.type === 'detail' && clickedItem.detailKind === 'mr') {
        openUrl(clickedItem.mr.webUrl);
      } else if (clickedItem?.type === 'issue') {
        const baseUrl = getJiraBaseUrl();
        openUrl(`${baseUrl}/browse/${clickedItem.item.key}`);
      }
      lastClickRef.current = { index: -1, time: 0 };
      return;
    }
    lastClickRef.current = { index, time: now };
    setSelectedIndex(index);
    scrollToItem(index);
  };

  const searchLower = searchQuery.toLowerCase();
  const itemMatchesSearch = (flatItem: (typeof flatItems)[number]) => {
    if (!searchQuery) return true;
    if (flatItem.type === 'detail') {
      return flatItem.issueKey.toLowerCase().includes(searchLower) ||
        flatItem.mr.title.toLowerCase().includes(searchLower) ||
        flatItem.mr.sourcebranch.toLowerCase().includes(searchLower);
    }
    return flatItem.item.key.toLowerCase().includes(searchLower) ||
      flatItem.item.fields.summary.toLowerCase().includes(searchLower);
  };

  const mrPickerOpen = mrPickerMrs.length > 0;

  useKeyboard((key: ParsedKey) => {
    if (mrPickerOpen) {
      switch (key.name) {
        case 'escape':
        case 'q':
          setMrPickerMrs([]);
          break;
        case 'j':
        case 'down':
          setMrPickerIndex(prev => Math.min(prev + 1, mrPickerMrs.length - 1));
          break;
        case 'k':
        case 'up':
          setMrPickerIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'return': {
          const mr = mrPickerMrs[mrPickerIndex];
          if (mr) {
            setMrPickerMrs([]);
            onClose();
            selectMrById({ mrId: mr.id });
          }
          break;
        }
      }
      return;
    }

    if (searchActive) {
      switch (key.name) {
        case 'escape':
          setSearchActive(false);
          setSearchQuery('');
          break;
        case 'return':
          setSearchActive(false);
          break;
        case 'backspace':
          setSearchQuery(prev => prev.slice(0, -1));
          break;
        default:
          if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
            setSearchQuery(prev => prev + key.sequence);
          }
          break;
      }
      return;
    }

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
        if (searchQuery) {
          setSearchQuery('');
        } else {
          onClose();
        }
        break;
      case '/':
        setSearchActive(true);
        break;
      case 'n': {
        if (!searchQuery) break;
        if (key.shift) {
          const beforeIdx = flatItems.findLastIndex((item, i) => i < selectedIndex && itemMatchesSearch(item));
          const prevMatch = beforeIdx >= 0 ? beforeIdx : flatItems.findLastIndex(itemMatchesSearch);
          if (prevMatch >= 0) {
            setSelectedIndex(prevMatch);
            scrollToItem(prevMatch);
          }
        } else {
          const afterIdx = flatItems.findIndex((item, i) => i > selectedIndex && itemMatchesSearch(item));
          const nextMatch = afterIdx >= 0 ? afterIdx : flatItems.findIndex(itemMatchesSearch);
          if (nextMatch >= 0) {
            setSelectedIndex(nextMatch);
            scrollToItem(nextMatch);
          }
        }
        break;
      }
      case 'j':
      case 'down': {
        const nextIdx = searchQuery
          ? flatItems.findIndex((item, i) => i > selectedIndex && itemMatchesSearch(item))
          : selectedIndex < flatItems.length - 1 ? selectedIndex + 1 : -1;
        if (nextIdx >= 0) {
          setSelectedIndex(nextIdx);
          scrollToItem(nextIdx);
        }
        break;
      }
      case 'k':
      case 'up': {
        const prevIdx = searchQuery
          ? flatItems.findLastIndex((item, i) => i < selectedIndex && itemMatchesSearch(item))
          : selectedIndex > 0 ? selectedIndex - 1 : -1;
        if (prevIdx >= 0) {
          setSelectedIndex(prevIdx);
          scrollToItem(prevIdx);
        }
        break;
      }
      case 'd':
        if (key.ctrl && scrollBoxRef.current) {
          const halfPage = Math.floor(scrollBoxRef.current.viewport.getLayoutNode().getComputedLayout().height / 2);
          const newIndex = Math.min(selectedIndex + halfPage, flatItems.length - 1);
          setSelectedIndex(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case 'u':
        if (key.ctrl && scrollBoxRef.current) {
          const halfPage = Math.floor(scrollBoxRef.current.viewport.getLayoutNode().getComputedLayout().height / 2);
          const newIndex = Math.max(selectedIndex - halfPage, 0);
          setSelectedIndex(newIndex);
          scrollToItem(newIndex);
        }
        break;
      case 'e':
        setEpicLegendVisible(!epicLegendVisible);
        break;
      case 'x': {
        const nextState: Record<CollapseState, CollapseState> = {
          normal: 'expanded',
          expanded: 'collapsed',
          collapsed: 'normal',
        };
        setSubtasksCollapsed(nextState[subtasksCollapsed]);
        setSelectedIndex(0);
        break;
      }
      case 'g':
        if (key.shift) {
          setGoalVisible(!goalVisible);
        }
        break;
      case 'o':
        if (key.shift) {
          setSortPopupVisible(true);
          setSortSelectedIndex(SORT_OPTIONS.findIndex(o => o.key === sortOrder));
        } else {
          const oItem = flatItems[selectedIndex];
          if (oItem?.type === 'detail' && oItem.detailKind === 'mr') {
            openUrl(oItem.mr.webUrl);
          } else if (oItem?.type === 'issue') {
            const baseUrl = getJiraBaseUrl();
            openUrl(`${baseUrl}/browse/${oItem.item.key}`);
          }
        }
        break;
      case 'i': {
        const iItem = flatItems[selectedIndex];
        if (iItem?.type === 'detail' && iItem.detailKind === 'mr') {
          openUrl(iItem.mr.webUrl);
        } else if (iItem?.type === 'issue') {
          const baseUrl = getJiraBaseUrl();
          openUrl(`${baseUrl}/browse/${iItem.item.key}`);
        }
        break;
      }
      case 'c': {
        const cItem = flatItems[selectedIndex];
        if (cItem?.type === 'detail' && cItem.detailKind === 'mr') {
          copyToClipboard(cItem.mr.webUrl);
        } else if (cItem?.type === 'issue') {
          const baseUrl = getJiraBaseUrl();
          copyToClipboard(`${baseUrl}/browse/${cItem.item.key}`);
        }
        break;
      }
      case 'y': {
        const yItem = flatItems[selectedIndex];
        if (yItem?.type === 'detail') {
          copyToClipboard(yItem.mr.sourcebranch);
        } else if (yItem?.type === 'issue') {
          copyToClipboard(yItem.item.key);
        }
        break;
      }
      case 'return': {
        const returnItem = flatItems[selectedIndex];
        if (returnItem?.type === 'detail' && returnItem.detailKind === 'mr') {
          onClose();
          selectMrById({ mrId: returnItem.mr.id });
        } else if (returnItem?.type === 'issue') {
          const linkedMrs = mrsByJiraKey.get(returnItem.item.key) ?? [];
          if (linkedMrs.length === 1) {
            onClose();
            selectMrById({ mrId: linkedMrs[0]!.id });
          } else if (linkedMrs.length > 1) {
            setMrPickerMrs(linkedMrs);
            setMrPickerIndex(0);
          }
        }
        break;
      }
      case 'r':
        if (currentBoardId) loadSprints(currentBoardId);
        break;
      case 'f':
        if (key.shift) {
          if (selectedSprintId && selectedSprint) {
            setSprintFilter(
              sprintFilter?.id === selectedSprintId
                ? null
                : { id: selectedSprintId, name: selectedSprint.name }
            );
          }
        } else {
          if (selectedSprintId && currentBoardId) {
            loadSprintIssues({ sprintId: selectedSprintId, boardId: currentBoardId });
          }
        }
        break;
      case 's':
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

  // Extra indent beyond the summary column to visually distinguish detail rows from tasks
  const DETAIL_INDENT = 59;

  const renderDetailRow = (flatItem: Extract<(typeof flatItems)[number], { type: 'detail' }>, index: number) => {
    const isSelected = index === selectedIndex;
    const isDimmed = !itemMatchesSearch(flatItem);
    const isRowDim = isDimmed || !!flatItem.dimColor;
    const dimColor = isDimmed ? Colors.SUPPORTING : (flatItem.dimColor ?? Colors.SUPPORTING);
    const dimAttr = isRowDim ? TextAttributes.DIM : undefined;
    const rowColor = isRowDim ? dimColor : flatItem.statusColor;

    const mr = flatItem.mr;
    const approvalIcon = mr.approvedBy.length > 0 ? '☒' : '☐';
    const approvalCount = mr.approvedBy.length > 0 ? mr.approvedBy.length : 1;
    const discussions = mr.resolvableDiscussions > 0
      ? ` 💬 ${mr.resolvedDiscussions}/${mr.resolvableDiscussions}`
      : '';

    return (
      <box
        key={`mr-${mr.id}`}
        id={`board-detail-${index}`}
        onMouseDown={() => handleItemClick(index)}
        style={{
          flexDirection: 'row',
          gap: 1,
          backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
        }}
      >
        <text wrapMode="none">{' '.repeat(DETAIL_INDENT)}</text>
        <text style={{ fg: isRowDim ? dimColor : Colors.NEUTRAL, attributes: dimAttr }} wrapMode="none">{'mr:'.padEnd(8)}</text>
        <text style={{ fg: rowColor, attributes: dimAttr }} wrapMode="none">!{mr.iid}</text>
        <text style={{ fg: rowColor, flexShrink: 1, attributes: dimAttr }} wrapMode="none">{mr.sourcebranch}</text>
        <text style={{ fg: isRowDim ? dimColor : Colors.NEUTRAL, flexShrink: 0, attributes: dimAttr }} wrapMode="none">{approvalIcon}{approvalCount}{discussions} ({mr.project.name})</text>
      </box>
    );
  };

  const renderList = () => {
    return flatItems.flatMap((flatItem, index) => {
      if (flatItem.type === 'detail') {
        return [renderDetailRow(flatItem, index)];
      }

      const { story, item } = flatItem;
      const isSelected = index === selectedIndex;
      const isDimmed = !itemMatchesSearch(flatItem);
      const status = mapStatus(item.fields.status.name);
      const icon = getIssueTypeIcon(item.fields.issuetype.name);
      const parentType = item.fields.parent?.fields.issuetype.name.toLowerCase();
      const isTopLevel = !item.fields.parent || parentType === 'epic';
      const statusPadded = status.text.padEnd(6);
      const epicName = parentType === 'epic' ? item.fields.parent?.fields.summary : null;
      const epicLabel = isTopLevel
        ? (epicName ?? 'no epic assigned').slice(0, 30).padEnd(30)
        : ''.padEnd(30);
      const keyPadded = item.key.padEnd(12);
      const priority = isTopLevel ? mapPriority(item.fields.priority.name) : null;
      const isRowDim = isDimmed || !!status.dimColor;
      const dimColor = isDimmed ? Colors.SUPPORTING : (status.dimColor ?? Colors.SUPPORTING);
      const dimAttr = isRowDim ? TextAttributes.DIM : undefined;

      const showSeparator = flatItem.itemIndex === 0 && flatItem.storyIndex > 0;

      // In expanded mode, MR info is shown as detail rows; in normal/collapsed, show inline
      const showInlineMrIndicator = subtasksCollapsed !== 'expanded';

      const row = (
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
            ? <text style={{ fg: isRowDim ? dimColor : (epicName ? story.epicColor : Colors.SUPPORTING), attributes: dimAttr }} wrapMode="none">{epicLabel}</text>
            : <text style={{ attributes: dimAttr }} wrapMode="none">{epicLabel}</text>
          }
          {isTopLevel && priority && (
            <text style={{ fg: isRowDim ? dimColor : priority.color, attributes: dimAttr }} wrapMode="none">●</text>
          )}
          {!isTopLevel && <text style={{ attributes: dimAttr }} wrapMode="none"> </text>}
          <text style={{ fg: isRowDim ? dimColor : status.color, attributes: dimAttr }} wrapMode="none">{statusPadded}</text>
          <text style={{ fg: isRowDim ? dimColor : Colors.NEUTRAL, attributes: dimAttr }} wrapMode="none">{icon}</text>
          <text style={{ fg: isRowDim ? dimColor : status.color, attributes: isRowDim ? TextAttributes.DIM : (isTopLevel ? TextAttributes.BOLD : undefined) }} wrapMode="none">{keyPadded}</text>
          <text style={{ fg: isRowDim ? dimColor : (isTopLevel ? Colors.SECONDARY : status.color), flexShrink: 1, attributes: isRowDim ? TextAttributes.DIM : (isTopLevel ? TextAttributes.BOLD : undefined) }} wrapMode="none">{item.fields.summary}</text>
          {item.fields.assignee && (
            <text style={{ fg: isRowDim ? dimColor : Colors.NEUTRAL, flexShrink: 0, attributes: dimAttr }} wrapMode="none"> @{item.fields.assignee.displayName}</text>
          )}
          {showInlineMrIndicator && (() => {
            const linkedMrs = mrsByJiraKey.get(item.key);
            if (!linkedMrs || linkedMrs.length === 0) return null;
            const approvedCount = linkedMrs.reduce((n, mr) => n + (mr.approvedBy.length > 0 ? 1 : 0), 0);
            const resolvable = linkedMrs.reduce((n, mr) => n + mr.resolvableDiscussions, 0);
            const resolved = linkedMrs.reduce((n, mr) => n + mr.resolvedDiscussions, 0);
            const indicator = [
              `!${linkedMrs.length}`,
              approvedCount > 0 ? `☒${approvedCount}` : `☐${linkedMrs.length}`,
              resolvable > 0 ? `💬 ${resolved}/${resolvable}` : null,
            ].filter(Boolean).join(' ');
            return (
              <text style={{ fg: isRowDim ? dimColor : Colors.INFO, flexShrink: 0, attributes: dimAttr }} wrapMode="none"> {indicator}</text>
            );
          })()}
        </box>
      );

      return showSeparator
        ? [<text key={`sep-${flatItem.storyIndex}`} style={{ fg: Colors.TRACK }} wrapMode="none">{'─'.repeat(120)}</text>, row]
        : [row];
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

  const renderMrPickerPopup = () => {
    if (!mrPickerOpen) return null;

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
            Select Merge Request
          </text>
          {mrPickerMrs.map((mr, index) => (
            <box
              key={mr.id}
              style={{
                backgroundColor: index === mrPickerIndex ? Colors.TRACK : undefined,
              }}
            >
              <text
                style={{
                  fg: index === mrPickerIndex ? Colors.PRIMARY : Colors.NEUTRAL,
                  attributes: index === mrPickerIndex ? TextAttributes.BOLD : undefined,
                }}
                wrapMode="none"
              >
                !{mr.iid} {mr.project.name} {mr.title.slice(0, 60)}
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
      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: Colors.PRIMARY, flexShrink: 0, attributes: TextAttributes.BOLD }} wrapMode="none">
            ✦ Sprint Board {selectedSprint ? `- ${selectedSprint.name}` : ''} {subtasksCollapsed !== 'normal' ? `[${subtasksCollapsed}]` : ''}
          </text>
          <text style={{ fg: Colors.SUPPORTING, flexShrink: 1 }} wrapMode="none">
            q: close | ↵: MR | S: board | r: sprints | f: fetch | F: filter MRs | G: goal | x: collapse | O: sort | o: open | y: yank
          </text>
        </box>
        {renderSprintTabs()}
        {goalVisible && selectedSprint?.goal && (
          <box style={{ marginBottom: 1 }}>
            {selectedSprint.goal.split('\n').filter(line => line.trim()).map((line, i) => (
              <text key={i} style={{ fg: Colors.SUPPORTING }} wrapMode="none">  {line.trim()}</text>
            ))}
          </box>
        )}
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

      {(searchActive || searchQuery) && (
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: Colors.SUCCESS }} wrapMode="none">/</text>
          <text style={{ fg: Colors.PRIMARY }} wrapMode="none">{searchQuery}</text>
          {searchActive && <text style={{ fg: Colors.SUCCESS }} wrapMode="none">▎</text>}
        </box>
      )}

      {epicLegendVisible && (
        <EpicLegend epicColors={epicColors} onClose={() => setEpicLegendVisible(false)} />
      )}

      {renderSortPopup()}
      {renderMrPickerPopup()}
    </box>
  );
}
