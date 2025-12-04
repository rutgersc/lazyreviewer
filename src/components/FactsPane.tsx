import { useState, useMemo } from 'react';
import { useKeyboard } from '@opentui/react';
import { useAtom, useAtomValue, useAtomSet, Result } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom } from '../ui/navigation-atom';
import { allEventsIncludingCompactedAtom, selectedEventIndexAtom, compactAllEventsAtom } from '../events/events-atom';
import { resultToArray } from '../utils/result-helpers';
import { EventStorage } from '../eventstore/eventStorage';
import { openFileInEditor } from '../utils/open-file';
import { appLayer } from '../appLayerRuntime';
import { Effect } from 'effect';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadSettings } from '../settings/settings';
import { allMrsAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, filterMrStateAtom } from '../mergerequests/mergerequests-atom';
import type { MergeRequestState } from '../graphql/generated/gitlab-base-types';
import { userSelectionsAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { selectedUserSelectionEntryIdAtom } from '../settings/settings-atom';
import type { UserSelectionEntry, UserOrGroupId, UserGroup } from '../userselection/userSelection';

interface ChangeDebugFile {
  eventType: string;
  timestamp: string;
  mrs: Record<string, {
    name: string;
    state: string;
    commentsDelta: string[];
    stateDelta?: string;
  }>;
}

interface MrChange {
  mrId: string;
  mrName: string;
  author: string;
  isNew: boolean;
  stateChange: string | null;
  commentsOnMyMr: number;
  commentsOnMyThread: number;
}

interface ChangeSummary {
  newMrs: number;
  comments: number;
  stateChanges: number;
  mrChanges: MrChange[];
}

function getChangesForEvent(
  event: { timestamp: string; type: string } | undefined,
  allMrsState: { mrsByGid: ReadonlyMap<string, any> } | null,
  currentUser: string
): ChangeSummary {
  if (!event) return { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };

  const fileTimestamp = event.timestamp.replace(/[:.]/g, "-");
  const debugFilePath = join(process.cwd(), "debug", "changes", `${fileTimestamp}_${event.type}_changes.json`);

  if (!existsSync(debugFilePath)) return { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };

  try {
    const data: ChangeDebugFile = JSON.parse(readFileSync(debugFilePath, 'utf-8'));
    const mrChanges: MrChange[] = [];
    let newMrs = 0;
    let comments = 0;
    let stateChanges = 0;

    for (const [mrId, mrData] of Object.entries(data.mrs)) {
      const mr = allMrsState?.mrsByGid.get(mrId);
      const author = mr?.author ?? 'Unknown';
      const mrAuthor = mr?.author;

      const isNew = mrData.stateDelta === 'opened';
      const stateChange = mrData.stateDelta && mrData.stateDelta !== 'opened'
        ? mrData.stateDelta
        : null;

      let commentsOnMyMr = 0;
      let commentsOnMyThread = 0;

      if (isNew) newMrs++;
      if (stateChange) stateChanges++;

      if (mrData.commentsDelta.length > 0 && mrAuthor === currentUser) {
        commentsOnMyMr = mrData.commentsDelta.length;
        comments += commentsOnMyMr;
      }

      if (mrData.commentsDelta.length > 0 && mr && mrAuthor !== currentUser) {
        const myNotes = mr.discussions.flatMap((d: any) => d.notes).filter((n: any) => n.author === currentUser);
        if (myNotes.length > 0) {
          commentsOnMyThread = mrData.commentsDelta.length;
          comments += commentsOnMyThread;
        }
      }

      if (isNew || stateChange || commentsOnMyMr > 0 || commentsOnMyThread > 0) {
        mrChanges.push({
          mrId,
          mrName: mrData.name,
          author,
          isNew,
          stateChange,
          commentsOnMyMr,
          commentsOnMyThread
        });
      }
    }

    return { newMrs, comments, stateChanges, mrChanges };
  } catch {
    return { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };
  }
}

interface GroupedMrChanges {
  new: MrChange[];
  merged: MrChange[];
  closed: MrChange[];
  reopened: MrChange[];
  comments: MrChange[];
}

function groupMrChangesByType(mrChanges: MrChange[]): GroupedMrChanges {
  const grouped: GroupedMrChanges = {
    new: [],
    merged: [],
    closed: [],
    reopened: [],
    comments: []
  };

  for (const mrChange of mrChanges) {
    if (mrChange.isNew) {
      grouped.new.push(mrChange);
    } else if (mrChange.stateChange === 'merged') {
      grouped.merged.push(mrChange);
    } else if (mrChange.stateChange === 'closed') {
      grouped.closed.push(mrChange);
    } else if (mrChange.stateChange === 'reopened') {
      grouped.reopened.push(mrChange);
    } else if (mrChange.commentsOnMyMr > 0 || mrChange.commentsOnMyThread > 0) {
      grouped.comments.push(mrChange);
    }
  }

  return grouped;
}

function formatStateChangeSummary(mrChanges: MrChange[]): string {
  const stateChangeCounts: Record<string, number> = {};

  for (const mrChange of mrChanges) {
    if (mrChange.stateChange) {
      stateChangeCounts[mrChange.stateChange] = (stateChangeCounts[mrChange.stateChange] || 0) + 1;
    }
  }

  const parts: string[] = [];
  if (stateChangeCounts.merged) {
    parts.push(`✓ ${stateChangeCounts.merged} merged`);
  }
  if (stateChangeCounts.closed) {
    parts.push(`✗ ${stateChangeCounts.closed} closed`);
  }
  if (stateChangeCounts.reopened) {
    parts.push(`↻ ${stateChangeCounts.reopened} reopened`);
  }

  return parts.join(', ');
}

function formatMrName(mrName: string): string {
  // const match = mrName.match(/^!(\d+)\s*-\s*(.+)$/);
  // if (match && match[2]) {
  //   return match[2];
  // }
  return mrName;
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
  const [selectedIndex, setSelectedIndex] = useAtom(selectedEventIndexAtom);
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

  const lastCompactionIndex = allEvents.findLastIndex(
    event => event.type === 'mergerequests-compacted-event'
  );

  const events = allEvents;
  const isActive = activePane === ActivePane.Facts;
  const currentUser = useMemo(() => loadSettings().currentUser, []);

  const allMrsState = useMemo(() =>
    Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    }), [allMrsResult]);

  // Get current event's changes for sublist navigation
  const currentEventIndex = highlightedIndex ?? events.length - 1;
  const currentEvent = events[currentEventIndex];
  const currentSummary = useMemo(() =>
    currentEvent && 'timestamp' in currentEvent
      ? getChangesForEvent(currentEvent as { timestamp: string; type: string }, allMrsState, currentUser)
      : { newMrs: 0, comments: 0, mrChanges: [] },
    [currentEvent, allMrsState, currentUser]
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

  const groupedEvents: EventGroup[] = useMemo(() => {
    const grouped: EventGroup[] = [];
    for (let i = 0; i < displayEvents.length; i++) {
      const reversedIndex = i;
      const originalIndex = events.length - 1 - reversedIndex;
      const event = displayEvents[i];
      if (!event) continue;

      const summary = 'timestamp' in event
        ? getChangesForEvent(event as { timestamp: string; type: string }, allMrsState, currentUser)
        : { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };
      const hasSummary = summary.newMrs > 0 || summary.comments > 0 || summary.stateChanges > 0;

      if (!hasSummary) {
        // Check if we can extend the last range
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup && lastGroup.type === 'range' && lastGroup.startIndex === originalIndex + 1) {
          lastGroup.startIndex = originalIndex;
        } else if (lastGroup && lastGroup.type === 'single' && lastGroup.startIndex === originalIndex + 1) {
          // Check if the last single event also has no summary
          const lastSummary = 'timestamp' in lastGroup.event
            ? getChangesForEvent(lastGroup.event as { timestamp: string; type: string }, allMrsState, currentUser)
            : { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };
          const lastHasSummary = lastSummary.newMrs > 0 || lastSummary.comments > 0 || lastSummary.stateChanges > 0;

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
  }, [displayEvents, events.length, allMrsState, currentUser]);

  // Helper to select MR and show suggestion if not in filtered list
  const selectMrById = (mrId: string, mrName: string) => {
    const mrIndex = filteredMrs.findIndex(mr => mr.id === mrId);
    if (mrIndex >= 0) {
      setSelectedMrIndex(mrIndex);
      setSuggestion(null);
    } else {
      // MR not in filtered list - show suggestion with author and state
      const mr = allMrsState?.mrsByGid.get(mrId);
      if (mr) {
        const suggestedSelection = findSelectionForAuthor(mr.author, userSelections, groups);
        setSuggestion({ mrName, author: mr.author, state: mr.state, suggestedSelection });
      }
    }
  };

  useKeyboard(async (key) => {
    if (!isActive) return;

    if (sublistFocused) {
      // Sublist navigation - also selects the MR
      const selectMrAtIndex = (idx: number) => {
        const mrChange = currentSummary.mrChanges[idx];
        if (mrChange) {
          selectMrById(mrChange.mrId, mrChange.mrName);
        }
      };

      if (key.name === 'j' || key.name === 'down') {
        const newIndex = Math.min(sublistIndex + 1, currentSummary.mrChanges.length - 1);
        setSublistIndex(newIndex);
        selectMrAtIndex(newIndex);
      } else if (key.name === 'k' || key.name === 'up') {
        const newIndex = Math.max(sublistIndex - 1, 0);
        setSublistIndex(newIndex);
        selectMrAtIndex(newIndex);
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
        setHighlightedIndex(prev => {
            const current = prev === null ? events.length - 1 : prev;
            // Find the group containing the current index
            const currentGroupIndex = groupedEvents.findIndex(g =>
                current >= g.startIndex && current <= g.endIndex
            );
            // Move to the next group (earlier in time, lower index)
            if (currentGroupIndex < 0 || currentGroupIndex >= groupedEvents.length - 1) {
                return Math.max(current - 1, 0);
            }
            const nextGroup = groupedEvents[currentGroupIndex + 1];
            return nextGroup ? nextGroup.endIndex : 0;
        });
    } else if (key.name === 'k' || key.name === 'up') {
        setSuggestion(null);
        setHighlightedIndex(prev => {
            const current = prev === null ? events.length - 1 : prev;
            // Find the group containing the current index
            const currentGroupIndex = groupedEvents.findIndex(g =>
                current >= g.startIndex && current <= g.endIndex
            );
            // Move to the previous group (later in time, higher index)
            if (currentGroupIndex <= 0) {
                return null;
            }
            const prevGroup = groupedEvents[currentGroupIndex - 1];
            return prevGroup ? prevGroup.startIndex : events.length - 1;
        });
    } else if (key.name === 'return') {
        // Enter - focus on sublist if there are changes
        if (currentSummary.mrChanges.length > 0) {
            setSublistFocused(true);
            setSublistIndex(0);
            // Select first MR
            const mrChange = currentSummary.mrChanges[0];
            if (mrChange) {
              selectMrById(mrChange.mrId, mrChange.mrName);
            }
        }
    } else if (key.name === 'g' && !key.shift) {
        // g - time-travel to this event
        setSelectedIndex(highlightedIndex);
    } else if (key.name === 'escape') {
        setSelectedIndex(null);
        setHighlightedIndex(null);
        setSuggestion(null);
    } else if (key.name === 'g' && key.shift) {
        // G - bottom (visually) -> Oldest group
        setSuggestion(null);
        const oldestGroup = groupedEvents[groupedEvents.length - 1];
        setHighlightedIndex(oldestGroup ? oldestGroup.startIndex : 0);
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
        setCompactionMessage('Opening event in editor...');
        try {
            const filePath = await EventStorage.getEventFilePath(eventIndex).pipe(
                Effect.provide(appLayer),
                Effect.runPromise
            );

            await openFileInEditor(filePath).pipe(
                Effect.provide(appLayer),
                Effect.runPromise
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
                <box width="100%" height={5} flexDirection="column" style={{ justifyContent: 'center' }}>
                    <text fg="#44475a" wrapMode="none">{'  ╭─────────────────────╮'}</text>
                    <text fg="#44475a" wrapMode="none">{'  │    LazyGitLab 🦊    │'}</text>
                    <text fg="#44475a" wrapMode="none">{'  │     Event Log       │'}</text>
                    <text fg="#44475a" wrapMode="none">{'  ╰─────────────────────╯'}</text>
                </box>
            )}
        </box>
        {compactionMessage && (
            <box height={1} width="100%" flexDirection="row">
                <text fg="#ffb86c" wrapMode="word">{compactionMessage}</text>
            </box>
        )}
        <scrollbox
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
                const rangeKey = `range-${group.startIndex}-${group.endIndex}`;
                const isCompacted = lastCompactionIndex >= 0 && group.startIndex < lastCompactionIndex;

                // Check if this range is highlighted or selected
                const currentHighlight = highlightedIndex === null ? events.length - 1 : highlightedIndex;
                const currentSelection = selectedIndex === null ? events.length - 1 : selectedIndex;
                const isHighlighted = currentHighlight >= group.startIndex && currentHighlight <= group.endIndex;
                const isSelected = currentSelection >= group.startIndex && currentSelection <= group.endIndex;

                let color = isCompacted ? '#6272a4' : '#44475a';
                let backgroundColor: string | undefined = undefined;

                if (isSelected && isHighlighted) {
                    color = '#50fa7b';
                    backgroundColor = '#44475a';
                } else if (isSelected) {
                    color = '#50fa7b';
                } else if (isHighlighted) {
                    color = '#8be9fd';
                    backgroundColor = '#44475a';
                }

                const handleRangeClick = () => {
                    setHighlightedIndex(group.startIndex);
                    setSublistFocused(false);
                    setSuggestion(null);
                };

                return (
                    <box key={rangeKey} flexDirection="column" width="100%">
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
            const isSelected = selectedIndex === originalIndex || (selectedIndex === null && originalIndex === events.length - 1);
            const isCompacted = lastCompactionIndex >= 0 && originalIndex < lastCompactionIndex;
            const isCompactionEvent = event.type === 'mergerequests-compacted-event';
            const isExpanded = isHighlighted;

            let color = '#f8f8f2';
            let backgroundColor: string | undefined = undefined;

            if (isCompacted) {
                color = '#6272a4';
            } else if (isCompactionEvent) {
                color = '#ffb86c';
            }

            if (isSelected && isHighlighted) {
                color = '#50fa7b';
                backgroundColor = '#44475a';
            } else if (isSelected) {
                color = '#50fa7b';
            } else if (isHighlighted) {
                color = '#8be9fd';
                backgroundColor = '#44475a';
            }

            const displayIndex = originalIndex.toString().padStart(4, ' ');
            const summary = 'timestamp' in event
                ? getChangesForEvent(event as { timestamp: string; type: string }, allMrsState, currentUser)
                : { newMrs: 0, comments: 0, stateChanges: 0, mrChanges: [] };
            const hasSummary = summary.newMrs > 0 || summary.comments > 0 || summary.stateChanges > 0;
            const stateChangeSummary = summary.stateChanges > 0 ? formatStateChangeSummary(summary.mrChanges) : '';

            const handleEventClick = () => {
                setHighlightedIndex(originalIndex);
                setSublistFocused(false);
                const mrChange = summary.mrChanges[0];
                if (mrChange) {
                    selectMrById(mrChange.mrId, mrChange.mrName);
                } else {
                    setSuggestion(null);
                }
            };

            const handleSublistClick = (i: number, mrChange: MrChange) => {
                setSublistFocused(true);
                setSublistIndex(i);
                selectMrById(mrChange.mrId, mrChange.mrName);
            };

            return (
                <box key={originalIndex} flexDirection="column" width="100%">
                    <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                        <text fg={color} bg={backgroundColor} wrapMode="word">
                            {displayIndex}
                        </text>
                        <text fg="#6272a4" bg={backgroundColor} wrapMode="word">
                            {` | ${event.type}`}
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
                    {summary.newMrs > 0 && (
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                            <text fg="#50fa7b" bg="#1e1f29">
                                {'      📋 '}{summary.newMrs}{' new MRs'}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    )}
                    {summary.stateChanges > 0 && (
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                            <text fg="#bd93f9" bg="#1e1f29">
                                {'      '}{stateChangeSummary}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    )}
                    {summary.comments > 0 && (
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                            <text fg="#ffb86c" bg="#1e1f29">
                                {'      💬 '}{summary.comments}{' comments'}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    )}
                    {isExpanded && summary.mrChanges.length > 0 && (() => {
                        const grouped = groupMrChangesByType(summary.mrChanges);
                        const allMrChanges: MrChange[] = [
                            ...grouped.new,
                            ...grouped.merged,
                            ...grouped.closed,
                            ...grouped.reopened,
                            ...grouped.comments
                        ];

                        return allMrChanges.map((mrChange, i) => {
                            const isSublistSelected = sublistFocused && i === sublistIndex;
                            let badge = '';
                            let badgeColor = '#bd93f9';

                            if (mrChange.isNew) {
                                badge = '📋';
                                badgeColor = '#50fa7b';
                            } else if (mrChange.stateChange === 'merged') {
                                badge = '✓';
                                badgeColor = '#bd93f9';
                            } else if (mrChange.stateChange === 'closed') {
                                badge = '✗';
                                badgeColor = '#ff5555';
                            } else if (mrChange.stateChange === 'reopened') {
                                badge = '↻';
                                badgeColor = '#ffb86c';
                            } else if (mrChange.commentsOnMyMr > 0 || mrChange.commentsOnMyThread > 0) {
                                badge = '💬';
                                badgeColor = '#ffb86c';
                            }

                            const commentCount = mrChange.commentsOnMyMr > 0
                                ? mrChange.commentsOnMyMr
                                : mrChange.commentsOnMyThread;
                            const commentText = commentCount > 0 ? ` - ${commentCount} comments` : '';

                            return (
                                <box key={i} height={1} width="100%" onMouseDown={() => handleSublistClick(i, mrChange)}>
                                    <text
                                      wrapMode='none'
                                        fg={isSublistSelected ? '#50fa7b' : badgeColor}
                                        bg={isSublistSelected ? '#44475a' : undefined}
                                    >
                                        {'      '}{badge} {formatMrName(mrChange.mrName)}{commentText} ({mrChange.author})
                                    </text>
                                </box>
                            );
                        });
                    })()}
                </box>
            );
        })}
        </scrollbox>
    </box>
  );
}
