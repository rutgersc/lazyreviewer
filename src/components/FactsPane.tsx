import { useState, useMemo, useRef } from 'react';
import { useKeyboard } from '@opentui/react';
import { useAtom, useAtomValue, useAtomSet, Result } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom, infoPaneTabAtom, nowAtom } from '../ui/navigation-atom';
import { targetNoteIdAtom } from './ActivityLog';
import { useDiscussionScroll } from '../hooks/useDiscussionScroll';
import { allEventsIncludingCompactedAtom, compactAllEventsAtom } from '../events/events-atom';
import { resultToArray } from '../utils/result-helpers';
import { EventStorage } from '../eventstore/eventStorage';
import { openFileInEditor } from '../utils/open-file';
import { appLayer } from '../appLayerRuntime';
import { Effect } from 'effect';
import { allMrsAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, filterMrStateAtom } from '../mergerequests/mergerequests-atom';
import type { MergeRequestState } from '../graphql/generated/gitlab-base-types';
import { userSelectionsAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { selectedUserSelectionEntryIdAtom } from '../settings/settings-atom';
import type { UserSelectionEntry, UserOrGroupId, UserGroup } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { eventChangesReadmodelAtom } from '../changetracking/change-tracking-atom';
import type { Change, MrChange } from '../changetracking/change-tracking-projection';
import type { LazyReviewerEvent } from '../events/events';
import { selectedJiraIndexAtom, selectedJiraSubIndexAtom } from '../jira/jira-atom';
import { useJiraScroll } from '../hooks/useJiraScroll';
import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { backgroundFetchAtom } from '../notifications/notification-sync-atom';

const formatTimeUntil = (targetDate: Date): string => {
  const now = Date.now();
  const diffMs = targetDate.getTime() - now;

  if (diffMs <= 0) return 'now';

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const isMrChange = (change: Change): change is MrChange => {
  switch (change.type) {
    case 'new-mr':
    case 'merged-mr':
    case 'closed-mr':
    case 'reopened-mr':
    case 'system-note':
    case 'diff-comment':
    case 'discussion-comment':
      return true;
    case 'new-jira-issue':
    case 'jira-status-changed':
    case 'jira-comment':
      return false;
    default:
      return false;
  }
};

function getChangeDescription(change: Change): { badge: string; color: string; text: string } {
  switch (change.type) {
    case 'new-mr':
      return { badge: '📋', color: '#50fa7b', text: `New MR: ${change.mr.mrName} (${change.mr.mrAuthor})` };
    case 'merged-mr':
      return { badge: '✓ ', color: '#bd93f9', text: `Merged: ${change.mr.mrName}` };
    case 'closed-mr':
      return { badge: '✗', color: '#ff5555', text: `Closed: ${change.mr.mrName}` };
    case 'reopened-mr':
      return { badge: '↻', color: '#ffb86c', text: `Reopened: ${change.mr.mrName}` };
    case 'system-note':
      return { badge: '⚙ ', color: '#6272a4', text: `${change.author}: ${change.body.slice(0, 50)}${change.body.length > 50 ? '...' : ''}` };
    case 'diff-comment':
      const lineInfo = change.line ? `:${change.line}` : '';
      const fileName = change.filePath.split('/').pop() ?? change.filePath;
      return { badge: '📝', color: '#8be9fd', text: `${change.author} on ${fileName}${lineInfo}` };
    case 'discussion-comment':
      return { badge: '💬', color: '#ffb86c', text: `${change.author} commented on ${change.mr.mrName}` };
    case 'new-jira-issue':
      return { badge: '🧩', color: '#50fa7b', text: `New Jira: ${change.issue.issueKey} - ${change.issue.summary}` };
    case 'jira-status-changed':
      return { badge: '🔄', color: '#bd93f9', text: `Jira ${change.issue.issueKey}: ${change.fromStatus ? `${change.fromStatus} → ` : ''}${change.toStatus}` };
    case 'jira-comment':
      return { badge: '💬', color: '#8be9fd', text: `${change.author} commented on ${change.issue.issueKey}` };
    default:
      const _: never = change;
      throw new Error("unreachable")
  }
}

function getNoteIdFromChange(change: Change): string | undefined {
  switch (change.type) {
    case 'system-note':
    case 'diff-comment':
    case 'discussion-comment':
      return change.noteId;
    default:
      return undefined;
  }
}

interface MrSuggestion {
  mrName: string;
  author: string;
  state: string;
  suggestedSelection: UserSelectionEntry | null;
}

function getUsernamesFromSelection(
  entry: UserSelectionEntry,
  groups: readonly UserGroup[]
): Set<string> {
  const usernames = new Set<string>();

  const processId = (id: UserOrGroupId) => {
    if (id.type === 'userId') {
      usernames.add(id.id);
    } else if (id.type === 'groupId') {
      const group = groups.find(g => g.id.id === id.id);
      if (group) {
        group.children.forEach(processId);
      }
    }
  };

  entry.selection.forEach(processId);
  return usernames;
}

function findSelectionForAuthor(
  author: string,
  userSelections: readonly UserSelectionEntry[],
  groups: readonly UserGroup[]
): UserSelectionEntry | null {
  for (const entry of userSelections) {
    const usernames = getUsernamesFromSelection(entry, groups);
    if (usernames.has(author)) {
      return entry;
    }
  }
  return null;
}

export default function FactsPane() {
  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const allEvents = resultToArray(useAtomValue(allEventsIncludingCompactedAtom));
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [compactionMessage, setCompactionMessage] = useState<string | null>(null);
  const [sublistFocused, setSublistFocused] = useState(false);
  const [sublistIndex, setSublistIndex] = useState(0);
  const [suggestion, setSuggestion] = useState<MrSuggestion | null>(null);
  const compactState = useAtomSet(compactAllEventsAtom, { mode: 'promise' });
  const allMrsResult = useAtomValue(allMrsAtom);
  const [, setSelectedMrIndex] = useAtom(selectedMrIndexAtom);
  const filteredMrs = useAtomValue(unwrappedMergeRequestsAtom);
  const userSelections = useAtomValue(userSelectionsAtom);
  const groups = useAtomValue(groupsAtom);
  const setSelectedUserSelectionEntryId = useAtomSet(selectedUserSelectionEntryIdAtom);
  const setFilterMrState = useAtomSet(filterMrStateAtom);
  const setInfoPaneTab = useAtomSet(infoPaneTabAtom);
  const setTargetNoteId = useAtomSet(targetNoteIdAtom);
  const { scroll: scrollToDiscussion } = useDiscussionScroll();
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const setSelectedJiraIndex = useAtomSet(selectedJiraIndexAtom);
  const setSelectedJiraSubIndex = useAtomSet(selectedJiraSubIndexAtom);
  const { scroll: scrollJira } = useJiraScroll();
  const lastClickRef = useRef<{ eventId: string; time: number } | null>(null);
  const now = useAtomValue(nowAtom);
  const backgroundSyncStatus = useAtomValue(backgroundFetchAtom);

  const lastCompactionIndex = allEvents.findLastIndex(
    event => event.type === 'compacted-event'
  );

  const emptySummary: Change[] = [];

  const events = allEvents;
  const isActive = activePane === ActivePane.Facts;
  const allMrsState = useMemo(() =>
    Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    }), [allMrsResult]);

  // Get current event's changes for sublist navigation
  const eventChangesReadmodel = useAtomValue(eventChangesReadmodelAtom);
  const emptyDeltasByEventId = useMemo(() => new Map<string, Change[]>(), []);
  const deltasByEventId = eventChangesReadmodel.pipe(
    Result.map(v => v.deltasByEventId),
    Result.getOrElse(() => emptyDeltasByEventId)
  );

  const getDeltaOrDefault = (ev: LazyReviewerEvent | undefined) =>
    deltasByEventId.get(ev?.eventId ?? "") ?? emptySummary;

  const currentEventIndex = highlightedIndex ?? events.length - 1;
  const currentEvent = events[currentEventIndex];
  // Extract the specific deltas for the current event
  const currentEventDeltas = currentEvent ? deltasByEventId.get(currentEvent.eventId) : undefined;
  const currentSummary = useMemo(
    () => getDeltaOrDefault(currentEvent),
    [currentEvent, currentEventDeltas]
  );

  // We want to display newest events at the top.
  const displayEvents = useMemo(() => {
    return [...events].reverse().slice(0, 100);
  }, [events]);

  // Group consecutive events without summaries into ranges
  interface EventGroup {
    type: 'single' | 'range';
    startIndex: number;
    endIndex: number;
    event: typeof events[0];
  }

  // Use a ref to avoid re-renders on every Map reference change
  // Only recalculate when the Map size changes (new entries added)
  const deltasByEventIdRef = useRef(deltasByEventId);
  deltasByEventIdRef.current = deltasByEventId;
  const deltasByEventIdSize = deltasByEventId.size;

  const groupedEvents: EventGroup[] = useMemo(() => {
    const deltas = deltasByEventIdRef.current;
    const grouped: EventGroup[] = [];
    for (let i = 0; i < displayEvents.length; i++) {
      const reversedIndex = i;
      const originalIndex = events.length - 1 - reversedIndex;
      const event = displayEvents[i];
      if (!event) continue;

      const summary = getDeltaOrDefault(event);
      const hasSummary = summary.length > 0;

      if (!hasSummary) {
        // Check if we can extend the last range
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup && lastGroup.type === 'range' && lastGroup.startIndex === originalIndex + 1) {
          lastGroup.startIndex = originalIndex;
        } else if (lastGroup && lastGroup.type === 'single' && lastGroup.startIndex === originalIndex + 1) {
          // Check if the last single event also has no summary
          const lastSummary = getDeltaOrDefault(lastGroup.event);
          const lastHasSummary = lastSummary.length > 0;

          if (!lastHasSummary) {
            // Convert single to range
            lastGroup.type = 'range';
            lastGroup.startIndex = originalIndex;
          } else {
            grouped.push({ type: 'single', startIndex: originalIndex, endIndex: originalIndex, event });
          }
        } else {
          grouped.push({ type: 'single', startIndex: originalIndex, endIndex: originalIndex, event });
        }
      } else {
        grouped.push({ type: 'single', startIndex: originalIndex, endIndex: originalIndex, event });
      }
    }
    return grouped;
  }, [displayEvents, events.length, allMrsState, deltasByEventIdSize]);

  // Helper to select MR - if not in filtered list, switch to appropriate selection directly
  // If noteId is provided, also navigate to the specified tab and select that note
  const selectMrById = (mrId: string, mrName: string, noteId?: string, navigateTo?: 'overview' | 'activity') => {
    const mrIndex = filteredMrs.findIndex(mr => mr.id === mrId);
    if (mrIndex >= 0) {
      setSelectedMrIndex(mrIndex);
      setSuggestion(null);

      // If a specific note is requested, navigate to the appropriate tab
      if (noteId && navigateTo) {
        setInfoPaneTab(navigateTo);
        if (navigateTo === 'overview') {
          // Use the scroll service - it will wait for the handler if needed
          void scrollToDiscussion(noteId);
        } else {
          setTargetNoteId(noteId);
        }
      }
    } else {
      // MR not in filtered list - switch to appropriate selection directly
      const mr = allMrsState?.mrsByGid.get(mrId);
      if (mr) {
        const suggestedSelection = findSelectionForAuthor(mr.author, userSelections, groups);
        if (suggestedSelection) {
          setSelectedUserSelectionEntryId(suggestedSelection.userSelectionEntryId);
          setFilterMrState(mr.state as MergeRequestState);
        }
      }
    }
  };

  const selectMrForChange = (change: Change) => {
    if (isMrChange(change)) {
      const noteId = getNoteIdFromChange(change);
      // For discussion comments, navigate to overview tab to show in unresolved discussions
      // For system notes, navigate to activity tab
      const navigateTo: 'overview' | 'activity' | undefined =
        change.type === 'diff-comment' || change.type === 'discussion-comment'
          ? 'overview'
          : change.type === 'system-note'
            ? 'activity'
            : undefined;
      selectMrById(change.mr.mrId, change.mr.mrName, noteId, navigateTo);
      return;
    }

    if (change.type === 'jira-comment' || change.type === 'jira-status-changed' || change.type === 'new-jira-issue') {
      const issueKey = change.issue.issueKey;
      const inFiltered = filteredMrs.find(mr => mr.jiraIssueKeys?.includes(issueKey));
      const fromAll = inFiltered
        ? inFiltered
        : allMrsState
          ? Array.from(allMrsState.mrsByGid.values()).find(mr => mr.jiraIssueKeys?.includes(issueKey))
          : undefined;

      if (fromAll) {
        console.log('selecting jira issue', issueKey, change);
        setInfoPaneTab('jira');
        selectMrById(fromAll.id, fromAll.title ?? issueKey);
        const issueIndex = fromAll.jiraIssueKeys.findIndex(k => k === issueKey);
        setSelectedJiraIndex(issueIndex >= 0 ? issueIndex : 0);
        setSelectedJiraSubIndex(0);
        void scrollJira(issueKey, change.type === 'jira-comment' ? change.commentId : undefined);
      }
    }
  };

  useKeyboard(async (key) => {
    if (!isActive) return;

    if (sublistFocused) {
      // Sublist navigation - also selects the MR
      const selectChangeAtIndex = (idx: number) => {
        const change = currentSummary[idx];
        if (change) {
          selectMrForChange(change);
        }
      };

      if (key.name === 'j' || key.name === 'down') {
        const newIndex = Math.min(sublistIndex + 1, currentSummary.length - 1);
        setSublistIndex(newIndex);
        selectChangeAtIndex(newIndex);
      } else if (key.name === 'k' || key.name === 'up') {
        const newIndex = Math.max(sublistIndex - 1, 0);
        setSublistIndex(newIndex);
        selectChangeAtIndex(newIndex);
      } else if (key.name === 'return') {
        // Enter - activate MR pane
        setActivePane(ActivePane.MergeRequests);
      } else if (key.name === 'escape') {
        setSublistFocused(false);
        setSublistIndex(0);
        setSuggestion(null);
      }
      return;
    }

    // Event list navigation - navigate by groups, not individual events
    if (key.name === 'j' || key.name === 'down') {
        setSuggestion(null);
        const current = highlightedIndex === null ? events.length - 1 : highlightedIndex;
        const currentGroupIndex = groupedEvents.findIndex(g =>
            current >= g.startIndex && current <= g.endIndex
        );
        // Move to the next group (earlier in time, lower index)
        if (currentGroupIndex >= groupedEvents.length - 1) {
            // Already at the last group, don't move
            return;
        } else if (currentGroupIndex < 0) {
            // Fallback - shouldn't normally happen
            setHighlightedIndex(Math.max(current - 1, 0));
        } else {
            const nextGroup = groupedEvents[currentGroupIndex + 1];
            const newIndex = nextGroup ? nextGroup.endIndex : 0;
            const newGroupIndex = currentGroupIndex + 1;
            setHighlightedIndex(newIndex);
            if (nextGroup) {
                scrollToId(nextGroup.event.eventId);
            }
        }
    } else if (key.name === 'k' || key.name === 'up') {
        setSuggestion(null);
        const current = highlightedIndex === null ? events.length - 1 : highlightedIndex;
        const currentGroupIndex = groupedEvents.findIndex(g =>
            current >= g.startIndex && current <= g.endIndex
        );
        // Move to the previous group (later in time, higher index)
        if (currentGroupIndex <= 0) {
            setHighlightedIndex(null);
            const firstGroup = groupedEvents[0];
            if (firstGroup) {
                scrollToId(firstGroup.event.eventId);
            }
        } else {
            const newGroupIndex = currentGroupIndex - 1;
            const prevGroup = groupedEvents[newGroupIndex];
            const newIndex = prevGroup ? prevGroup.startIndex : events.length - 1;
            setHighlightedIndex(newIndex);
            if (prevGroup) {
                scrollToId(prevGroup.event.eventId);
            }
        }
    } else if (key.name === 'return') {
        // Enter - focus on sublist if there are changes
        if (currentSummary.length > 0) {
            setSublistFocused(true);
            setSublistIndex(0);
            // Select first change's MR
            const change = currentSummary[0];
            if (change) {
              selectMrForChange(change);
            }
        }
    } else if (key.name === 'g' && !key.shift) {
      // nothing
    } else if (key.name === 'escape') {
        setHighlightedIndex(null);
        setSuggestion(null);
    } else if (key.name === 'g' && key.shift) {
        // G - bottom (visually) -> Oldest group
        setSuggestion(null);
        const lastGroupIndex = groupedEvents.length - 1;
        const oldestGroup = groupedEvents[lastGroupIndex];
        setHighlightedIndex(oldestGroup ? oldestGroup.startIndex : 0);
        if (oldestGroup) {
            scrollToId(oldestGroup.event.eventId);
        }
    } else if (key.name === 'c') {
        setCompactionMessage('Compacting...');
        try {
            const result = await compactState();
            setCompactionMessage(result.message);
            setTimeout(() => setCompactionMessage(null), 3000);
        } catch (error) {
            setCompactionMessage(`Compaction failed: ${error}`);
            setTimeout(() => setCompactionMessage(null), 3000);
        }
    } else if (key.name === 'e') {
        const eventIndex = highlightedIndex ?? events.length - 1;
        setCompactionMessage(highlightedIndex + 'Opening event in editor...');
        try {
            const filePath = await Effect.runPromise(
              EventStorage.getEventFilePath(eventIndex).pipe(
                Effect.provide(appLayer)
              )
            );

            await Effect.runPromise(
              openFileInEditor(filePath).pipe(
                Effect.provide(appLayer)
              )
            );

            setCompactionMessage(`Opened: ${filePath}`);
            setTimeout(() => setCompactionMessage(null), 3000);
        } catch (error) {
            setCompactionMessage(`Failed to open: ${error}`);
            setTimeout(() => setCompactionMessage(null), 3000);
        }
    }
  });

  return (
    <box
      flexDirection="column"
      height="100%"
      width="100%"
      onMouseDown={() => setActivePane(ActivePane.Facts)}
    >
        {/* Suggestion box - reserved space to prevent list jumping */}
        <box
            width="100%"
            height={6}
            flexDirection="column"
            style={{
                marginBottom: 1,
            }}
        >
            {suggestion ? (
                <box
                    key="suggestion-box"
                    width="100%"
                    flexDirection="column"
                    style={{
                        border: true,
                        borderColor: '#ffb86c',
                    }}
                >
                    <box height={1} width="100%" flexDirection="row">
                        <text fg="#ffb86c" wrapMode="none">
                            {' ⚠ MR not in view'}
                        </text>
                    </box>
                    <box height={1} width="100%" flexDirection="row">
                        <text fg="#f8f8f2" wrapMode="none">
                            {` Author: ${suggestion.author}, State: ${suggestion.state}`}
                        </text>
                    </box>
                    {suggestion.suggestedSelection ? (
                        <box
                            height={1}
                            width="100%"
                            flexDirection="row"
                            onMouseDown={() => {
                                if (suggestion.suggestedSelection) {
                                    setSelectedUserSelectionEntryId(suggestion.suggestedSelection.userSelectionEntryId);
                                    setFilterMrState(suggestion.state as MergeRequestState);
                                    setSuggestion(null);
                                }
                            }}
                        >
                            <text fg="#282a36" bg="#50fa7b" wrapMode="none">
                                {` Switch to "${suggestion.suggestedSelection.name}" (${suggestion.state}) `}
                            </text>
                        </box>
                    ) : (
                        <box height={1} width="100%" flexDirection="row">
                            <text fg="#6272a4" wrapMode="none">
                                {' (no matching selection found)'}
                            </text>
                        </box>
                    )}
                </box>
            ) : (
                <box key="logo-box" width="100%" height={6} flexDirection="column" style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#282a36' }}>
                    <text fg="#44475a" wrapMode="none">{'╭─────────────────────╮'}</text>
                    <text fg="#44475a" wrapMode="none">{'│    LazyGitLab 🦊    │'}</text>
                    <text fg="#44475a" wrapMode="none">{'│     Event Log       │'}</text>
                    <text fg="#44475a" wrapMode="none">{'╰─────────────────────╯'}</text>
                    {Result.isSuccess(backgroundSyncStatus) && backgroundSyncStatus.value._tag === 'syncPending' && (
                        <text fg="#6272a4" wrapMode="none">
                            refreshing {`${backgroundSyncStatus.value.userSelection.name}`} in {formatTimeUntil(backgroundSyncStatus.value.nextRefreshDate)}
                        </text>
                    )}
                </box>
            )}
        </box>
        {compactionMessage && (
            <box height={1} width="100%" flexDirection="row">
                <text fg="#ffb86c" wrapMode="word">{compactionMessage}</text>
            </box>
        )}
        <scrollbox
            ref={scrollBoxRef}
            style={{
                flexGrow: 1,
                contentOptions: {
                    backgroundColor: '#282a36',
                },
                viewportOptions: {
                    backgroundColor: '#282a36',
                },
                scrollbarOptions: {
                    width: 1,
                    trackOptions: {
                        foregroundColor: '#bd93f9',
                        backgroundColor: '#1e1f29',
                    },
                },
            }}
        >
        {groupedEvents.map((group, groupIndex) => {
            if (group.type === 'range') {
                // Render collapsed range (2 lines to match alignment)
                const isCompacted = lastCompactionIndex >= 0 && group.startIndex < lastCompactionIndex;

                // Check if this range is highlighted or selected
                const currentHighlight = highlightedIndex === null ? events.length - 1 : highlightedIndex;
                const isHighlighted = currentHighlight >= group.startIndex && currentHighlight <= group.endIndex;
                const isSelected = false; // currentSelection >= group.startIndex && currentSelection <= group.endIndex;

                let color = isCompacted ? '#e1cd39ff' : '#44475a';
                let backgroundColor: string | undefined = undefined;

                if (isSelected && isHighlighted) {
                    color = '#5af78e';
                    backgroundColor = '#2d2f3a';
                } else if (isSelected) {
                    color = '#50fa7b';
                } else if (isHighlighted) {
                    color = '#5fd7ff';
                    backgroundColor = '#3a3d4e';
                }

                const handleRangeClick = () => {
                    setHighlightedIndex(group.startIndex);
                    setSublistFocused(false);
                    setSuggestion(null);
                };

                return (
                    <box key={group.event.eventId} id={group.event.eventId} flexDirection="column" width="100%">
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleRangeClick}>
                            <text fg={color} bg={backgroundColor} wrapMode="word">
                                {`${group.startIndex.toString().padStart(4, ' ')}...${group.endIndex.toString().padEnd(4, ' ')} | (no changes)`}
                            </text>
                        </box>
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleRangeClick}>
                            <text fg={isHighlighted ? color : '#44475a'} bg="#1e1f29">
                                {'      —'}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    </box>
                );
            }

            // Render single event normally
            const originalIndex = group.startIndex;
            const event = group.event;
            const isHighlighted = highlightedIndex === originalIndex || (highlightedIndex === null && originalIndex === events.length - 1);
            const isSelected = false; // selectedIndex === originalIndex || (selectedIndex === null && originalIndex === events.length - 1);
            const isCompacted = lastCompactionIndex >= 0 && originalIndex < lastCompactionIndex;
            const isCompactionEvent = event.type === 'compacted-event';

            let color = '#f8f8f2';
            let backgroundColor: string | undefined = undefined;

            if (isCompacted) {
                color = '#6272a4';
            } else if (isCompactionEvent) {
                color = '#ffb86c';
            }

            if (isSelected && isHighlighted) {
                color = '#5af78e';
                backgroundColor = '#2d2f3a';
            } else if (isSelected) {
                color = '#50fa7b';
            } else if (isHighlighted) {
                color = '#5fd7ff';
                backgroundColor = '#3a3d4e';
            }

            const displayIndex = ' ' + originalIndex.toString().padEnd(4, ' ');
            const summary = getDeltaOrDefault(event);
            const hasSummary = summary.length > 0;

            const handleEventClick = () => {
                const now = Date.now();
                const lastClick = lastClickRef.current;
                const isDoubleClick = lastClick && lastClick.eventId === event.eventId && (now - lastClick.time) < 300;

                lastClickRef.current = { eventId: event.eventId, time: now };

                if (isDoubleClick && summary.length > 0) {
                    // Double-click: focus on sublist (like pressing Enter)
                    setHighlightedIndex(originalIndex);
                    setSublistFocused(true);
                    setSublistIndex(0);
                    const change = summary[0];
                    if (change) {
                        selectMrForChange(change);
                    }
                } else {
                    // Single click: just highlight
                    setHighlightedIndex(originalIndex);
                    setSublistFocused(false);
                    const change = summary[0];
                    if (change) {
                        selectMrForChange(change);
                    } else {
                        setSuggestion(null);
                    }
                }
            };

            const handleChangeClick = (i: number, change: Change) => {
                setHighlightedIndex(originalIndex);
                setSublistFocused(true);
                setSublistIndex(i);
                selectMrForChange(change);
            };
            const formatRelativeTime = (date: Date) => {
              const diffMs = now.getTime() - date.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);
              const diffWeeks = Math.floor(diffDays / 7);
              const diffMonths = Math.floor(diffDays / 30);

              if (diffMins < 1) return 'now';
              if (diffMins < 60) return `${diffMins}m`;
              if (diffHours < 24) return `${diffHours}h`;
              if (diffDays < 7) return `${diffDays}d`;
              if (diffDays < 30) return `${diffWeeks}w`;
              return `${diffMonths}M`;
            };

            return (
                <box key={group.event.eventId} id={group.event.eventId} flexDirection="column" width="100%">
                    <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                        <text fg={color} bg={backgroundColor} wrapMode="word">
                            {displayIndex}
                        </text>
                        <text fg={color} bg={backgroundColor} wrapMode="word">
                            {`>> ${event.type}`}
                        </text>
                    </box>
                    {!hasSummary && (
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                            <text fg="#44475a" bg="#1e1f29">
                                {'      —'}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    )}
                    {summary.map((change, i) => {
                        const isSelected = isHighlighted && sublistFocused && i === sublistIndex;
                        const { badge, color: changeColor, text } = getChangeDescription(change);

                        const formattedDate = change.changedAt
                          ? formatRelativeTime(change.changedAt).padEnd(3, ' ')
                          : '?  ';

                        return (
                            <box key={i} height={1} width="100%" flexDirection='row' onMouseDown={() => handleChangeClick(i, change)}>
                                <box width={4} flexShrink={0} height={1}>
                                    <text
                                        wrapMode='none'
                                        fg={Colors.PRIMARY}
                                        bg={isSelected ? '#44475a' : '#1e1f29'}
                                        style={{attributes: TextAttributes.DIM}}
                                    >
                                        {' '}{formattedDate}
                                    </text>
                                </box>
                                <text
                                    wrapMode='none'
                                    fg={isSelected ? '#50fa7b' : changeColor}
                                    bg={isSelected ? '#44475a' : '#1e1f29'}
                                >
                                    {' '}{badge} {text}
                                </text>
                            </box>
                        );
                    })}
                </box>
            );
        })}
        </scrollbox>
    </box>
  );
}
