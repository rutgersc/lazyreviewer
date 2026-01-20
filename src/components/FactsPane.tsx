import { useRef, useEffect } from 'react';
import { useAtom, useAtomValue, useAtomSet, Result, Atom } from '@effect-atom/atom-react';
import { ActivePane } from '../userselection/userSelection';
import { activePaneAtom, infoPaneTabAtom, nowAtom } from '../ui/navigation-atom';
import { targetNoteIdAtom } from './ActivityLog';
import { useDiscussionScroll } from '../hooks/useDiscussionScroll';
import { allEventsIncludingCompactedAtom, compactAllEventsAtom } from '../events/events-atom';
import { resultToArray } from '../utils/result-helpers';
import { allMrsAtom, unwrappedMergeRequestsAtom, isMergeRequestsLoadingAtom, selectMrByIdAtom } from '../mergerequests/mergerequests-atom';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { eventChangesReadmodelAtom } from '../changetracking/change-tracking-atom';
import type { Change } from '../changetracking/change-tracking-projection';
import { FILTERED_SYSTEM_NOTE_TYPES, isMrChange } from '../changetracking/mr-change-tracking-projection';
import { groupChanges } from '../changetracking/change-grouping';
import type { LazyReviewerEvent } from '../events/events';
import { useJiraScroll } from '../hooks/useJiraScroll';
import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { getAgeColor } from '../utils/formatting';
import { backgroundFetchAtom } from '../notifications/notification-sync-atom';
import { selectedJiraIndexAtom, selectedJiraSubIndexAtom } from './JiraIssuesList';

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

const isFilteredSystemNote = (change: Change): boolean =>
  change.type === 'system-note' && FILTERED_SYSTEM_NOTE_TYPES.has(change.systemNoteType);

function getJiraPrefix(change: Change): string {
  if (isMrChange(change)) {
    const key = change.mr.jiraIssueKeys[0];
    return key ? `[${key}] ` : '';
  }
  // Jira changes
  if (change.type === 'new-jira-issue' || change.type === 'jira-status-changed' || change.type === 'jira-comment') {
    return `[${change.issue.issueKey}] `;
  }
  return '';
}

function getChangeDescription(change: Change): { badge: string; color: string; text: string } {
  const jira = getJiraPrefix(change);
  switch (change.type) {
    case 'new-mr':
      return { badge: '📋', color: '#50fa7b', text: `${jira}New MR: ${change.mr.mrName} (${change.mr.mrAuthor})` };
    case 'merged-mr':
      return { badge: '✓ ', color: '#bd93f9', text: `${jira}Merged: ${change.mr.mrName}` };
    case 'closed-mr':
      return { badge: '✗', color: '#ff5555', text: `${jira}Closed: ${change.mr.mrName}` };
    case 'reopened-mr':
      return { badge: '↻', color: '#ffb86c', text: `${jira}Reopened: ${change.mr.mrName}` };
    case 'system-note':
      return { badge: '⚙ ', color: '#6272a4', text: `${jira}${change.author}: ${change.body.slice(0, 50)}${change.body.length > 50 ? '...' : ''}` };
    case 'system-notes-compacted':
      const author = change.authors[0];
      switch (change.systemNoteType) {
        case 'commits-added':
          return {
            badge: '⚙ ',
            color: '#6272a4',
            text: `${jira}${author}: added ${change.count} commits`
          };
        case 'approved':
          return {
            badge: '⚙ ',
            color: '#6272a4',
            text: `${jira}${author}: approved this merge request ${change.count} times`
          };
        case 'mentioned-in-mr':
          return {
            badge: '⚙ ',
            color: '#6272a4',
            text: `${jira}${author}: mentioned in ${change.count} merge requests`
          };
        default:
          return {
            badge: '⚙ ',
            color: '#6272a4',
            text: `${jira}${author}: ${change.count} system notes`
          };
      }
    case 'diff-comment':
      const lineInfo = change.line ? `:${change.line}` : '';
      const fileName = change.filePath.split('/').pop() ?? change.filePath;
      return { badge: '📝', color: '#8be9fd', text: `${jira}${change.author} on ${fileName}${lineInfo}` };
    case 'discussion-comment':
      return { badge: '💬', color: '#ffb86c', text: `${jira}${change.author} commented on ${change.mr.mrName}` };
    case 'new-jira-issue':
      return { badge: '🧩', color: '#50fa7b', text: `${jira}New Jira: ${change.issue.summary}` };
    case 'jira-status-changed':
      return { badge: '🔄', color: '#bd93f9', text: `${jira}${change.fromStatus ? `${change.fromStatus} → ` : ''}${change.toStatus}` };
    case 'jira-comment':
      return { badge: '💬', color: '#8be9fd', text: `${jira}${change.author} commented` };
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

export const sublistFocusedAtom = Atom.make(false);
export const sublistIndexAtom = Atom.make(0);
export const highlightedIndexAtom = Atom.make<number | null>(null);

  const emptyChange: Change[] = [];

export const currentEventChangesAtom = Atom.readable<Change[]>(get => {
  const allEvents = resultToArray(get(allEventsIncludingCompactedAtom));
  const highlightedIndex = get(highlightedIndexAtom);

  const currentEventIndex = highlightedIndex ?? allEvents.length - 1;
  const currentEvent = allEvents[currentEventIndex];

  const eventChangesReadmodel = get(eventChangesReadmodelAtom);
  const emptyDeltasByEventId = new Map<string, Change[]>();
  const deltasByEventId = eventChangesReadmodel.pipe(
    Result.map(v => v.deltasByEventId),
    Result.getOrElse(() => emptyDeltasByEventId)
  );

  const getDeltas = (ev: LazyReviewerEvent | undefined) => {
    const rawDeltas = (deltasByEventId.get(ev?.eventId ?? "") ?? emptyChange)
      .filter(c => !isFilteredSystemNote(c));
    return groupChanges(rawDeltas).reverse();
  };

  return getDeltas(currentEvent);
});

// Event group for navigation
export interface EventGroup {
  type: 'single' | 'range';
  startIndex: number;
  endIndex: number;
  event: LazyReviewerEvent;
}

export const scrollToEventIdRequestAtom = Atom.make<string | null>(null);

export const compactionMessageAtom = Atom.make<string | null>(null);

export const displayEventsAtom = Atom.readable((get) => {
});

const deltasByEventIdAtom = Atom.readable((get) => {
  const eventChangesReadmodel = get(eventChangesReadmodelAtom);
  const emptyDeltasByEventId = new Map<string, Change[]>();

  return eventChangesReadmodel.pipe(
    Result.map(v => v.deltasByEventId),
    Result.getOrElse(() => emptyDeltasByEventId)
  );
});

type ClassifiedEvent = {
  event: LazyReviewerEvent;
  originalIndex: number;
  grouping: 'single' | 'range';
};

const groupClassifiedEvents = (events: ClassifiedEvent[]): EventGroup[] =>
  events.reduce<EventGroup[]>((groups, { event, originalIndex, grouping }) => {
    // Singles always start a new group
    if (grouping === 'single') {
      return [...groups, { type: 'single', startIndex: originalIndex, endIndex: originalIndex, event }];
    }

    // Range: check if we can continue the previous group
    const lastGroup = groups[groups.length - 1];
    const canContinue = lastGroup?.type === 'range' && lastGroup.startIndex === originalIndex + 1;

    if (canContinue) {
      return [...groups.slice(0, -1), { ...lastGroup, startIndex: originalIndex }];
    }

    // Start a new range group
    return [...groups, { type: 'range', startIndex: originalIndex, endIndex: originalIndex, event }];
  }, []);

export const groupedEventsAtom = Atom.readable<EventGroup[]>((get) => {
  const allEvents = resultToArray(get(allEventsIncludingCompactedAtom));
  const deltasByEventId = get(deltasByEventIdAtom);
  const displayEvents = [...allEvents].reverse().slice(0, 50);

  const hasVisibleDeltas = (ev: LazyReviewerEvent): boolean => {
    const rawDeltas = deltasByEventId.get(ev.eventId) ?? emptyChange;
    return groupChanges(rawDeltas.filter(c => !isFilteredSystemNote(c))).length > 0;
  };

  const firstWithChanges = displayEvents.findIndex(ev => ev && hasVisibleDeltas(ev));

  // Step 1: Classify each event as 'single' or 'range'
  const classified: ClassifiedEvent[] = displayEvents
    .map((event, displayIndex) => {
      if (!event) return null;
      const originalIndex = allEvents.length - 1 - displayIndex;
      const canBeRanged = firstWithChanges >= 0 && displayIndex >= firstWithChanges && !hasVisibleDeltas(event);
      return { event, originalIndex, grouping: canBeRanged ? 'range' as const : 'single' as const };
    })
    .filter((e): e is ClassifiedEvent => e !== null);

  // Step 2: Reduce consecutive 'range' events into groups
  const grouped = groupClassifiedEvents(classified);

  return grouped;
});

export const selectMrForChangeAtom = Atom.fnSync((change: Change, get) => {
  const selectMrAndNavigate = (mrId: string, noteId?: string, navigateTo?: 'overview' | 'activity') => {
    get.registry.set(selectMrByIdAtom, { mrId });

    if (noteId && navigateTo) {
      get.registry.set(infoPaneTabAtom, navigateTo);
      if (navigateTo === 'activity') {
        get.registry.set(targetNoteIdAtom, noteId);
      }
      // TODOR: handle 'overview' case with scrollToDiscussion
    }
  };

  if (isMrChange(change)) {
    // Handle compacted changes - navigate to the MR, but don't try to navigate to specific note
    if (change.type === 'system-notes-compacted') {
      get.registry.set(selectMrByIdAtom, { mrId: change.mr.mrId });
      return;
    }

    const noteId = getNoteIdFromChange(change);
    const navigateTo: 'overview' | 'activity' | undefined =
      change.type === 'diff-comment' || change.type === 'discussion-comment'
        ? 'overview'
        : change.type === 'system-note'
          ? 'activity'
          : undefined;

    selectMrAndNavigate(change.mr.mrId, noteId, navigateTo);
    return;
  }

  if (change.type === 'jira-comment' || change.type === 'jira-status-changed' || change.type === 'new-jira-issue') {
    const filteredMrs = get(unwrappedMergeRequestsAtom);
    const allMrsResult = get(allMrsAtom);

    const allMrsState = Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    });

    const issueKey = change.issue.issueKey;
    const inFiltered = filteredMrs.find(mr => mr.jiraIssueKeys?.includes(issueKey));
    const fromAll = inFiltered
      ? inFiltered
      : allMrsState
        ? Array.from(allMrsState.mrsByGid.values()).find(mr => mr.jiraIssueKeys?.includes(issueKey))
        : undefined;

    if (fromAll) {
      get.registry.set(infoPaneTabAtom, 'jira');
      selectMrAndNavigate(fromAll.id);
      const issueIndex = fromAll.jiraIssueKeys.findIndex(k => k === issueKey);
      get.registry.set(selectedJiraIndexAtom, issueIndex >= 0 ? issueIndex : 0);
      get.registry.set(selectedJiraSubIndexAtom, 0);

      const { scroll: scrollJira } = useJiraScroll();
      void scrollJira(issueKey, change.type === 'jira-comment' ? change.commentId : undefined);
    }
  }
});

export default function FactsPane() {
  const [, setActivePane] = useAtom(activePaneAtom);
  const allEvents = resultToArray(useAtomValue(allEventsIncludingCompactedAtom));
  const [highlightedIndex, setHighlightedIndex] = useAtom(highlightedIndexAtom);
  const compactionMessage = useAtomValue(compactionMessageAtom);
  const [sublistFocused, setSublistFocused] = useAtom(sublistFocusedAtom);
  const [sublistIndex, setSublistIndex] = useAtom(sublistIndexAtom);
  const selectMrForChange = useAtomSet(selectMrForChangeAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });
  const [scrollToEventIdRequest, setScrollToEventIdRequest] = useAtom(scrollToEventIdRequestAtom);
  const groupedEvents = useAtomValue(groupedEventsAtom);
  const lastClickRef = useRef<{ eventId: string; time: number } | null>(null);
  const now = useAtomValue(nowAtom);
  const backgroundSyncStatus = useAtomValue(backgroundFetchAtom);

  const isLoading = useAtomValue(isMergeRequestsLoadingAtom);

  const lastCompactionIndex = allEvents.findLastIndex(
    event => event.type === 'compacted-event'
  );

  // Handle scroll requests from actions
  useEffect(() => {
    if (scrollToEventIdRequest) {
      scrollToId(scrollToEventIdRequest);
      setScrollToEventIdRequest(null);
    }
  }, [scrollToEventIdRequest, scrollToId, setScrollToEventIdRequest]);

  // Get current event's changes for sublist navigation
  const eventChangesReadmodel = useAtomValue(eventChangesReadmodelAtom);
  const deltasByEventId = eventChangesReadmodel.pipe(
    Result.map(v => v.deltasByEventId),
    Result.getOrElse(() => new Map<string, Change[]>())
  );

  const getDeltas = (ev: LazyReviewerEvent | undefined) => {
    const rawDeltas = (deltasByEventId.get(ev?.eventId ?? "") ?? emptyChange)
      .filter(c => !isFilteredSystemNote(c));
    return groupChanges(rawDeltas).reverse();
  };

  const logoBox = () => {
    const autoRefreshDisplay = (status: typeof backgroundSyncStatus) => {

      const res = Result.match(status, {
        onInitial: (s) => {
          return "initial";
        },
        onFailure: (f) => {
          return `onFailure: ${f.cause.toString()}`
        },
        onSuccess: (backgroundSyncStatus) => {
          switch (backgroundSyncStatus.value._tag) {
            case 'syncDisabled':
              return "sync disabled";
            case 'syncPending':
               return `syncing '${backgroundSyncStatus.value.userSelection.name}' in ${formatTimeUntil(backgroundSyncStatus.value.nextRefreshDate)}`;
            case 'syncing':
               return `refreshing '${backgroundSyncStatus.value.userSelection.name}'...`;
            case 'syncPerformed':
               return `refreshed ${backgroundSyncStatus.value}: took ${backgroundSyncStatus.value.duration}`;
            default:
              const _: never = backgroundSyncStatus.value;
          }
        }
      })

      return (
        <text fg="#6272a4" wrapMode="none">
          {res}
        </text>
      );
    }

    return (
      <box key="logo-box" width="100%" height={6} flexDirection="column" style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#282a36' }}>
        <text fg="#44475a" wrapMode="none">{'╭─────────────────────╮'}</text>
        <text fg="#44475a" wrapMode="none">{'│    LazyGitLab 🦊    │'}</text>
        <text fg="#44475a" wrapMode="none">{'╰─────────────────────╯'}</text>
        {isLoading
          ? (
              <text fg="#8be9fd" wrapMode="none">
                  refreshing...
              </text>)
          : autoRefreshDisplay(backgroundSyncStatus)
        }
      </box>);
  }

  return (
    <box
      flexDirection="column"
      height="100%"
      width="100%"
      onMouseDown={() => setActivePane(ActivePane.Facts)}
    >
        {/* Logo box - reserved space to prevent list jumping */}
        <box
            width="100%"
            height={6}
            flexDirection="column"
            style={{
                marginBottom: 1,
            }}
        >
            {logoBox()}
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
                const currentHighlight = highlightedIndex === null ? allEvents.length - 1 : highlightedIndex;
                const isHighlighted = currentHighlight >= group.startIndex && currentHighlight <= group.endIndex;
                const isSelected = false; // currentSelection >= group.startIndex && currentSelection <= group.endIndex;

                let color = isCompacted ? '#e1cd39ff' : '#c8c9caff';
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
            const isHighlighted = highlightedIndex === originalIndex || (highlightedIndex === null && originalIndex === allEvents.length - 1);
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
            const eventDeltas = getDeltas(event);
            const hasEventDeltas = eventDeltas.length > 0;

            const handleEventClick = () => {
                const now = Date.now();
                const lastClick = lastClickRef.current;
                const isDoubleClick = lastClick && lastClick.eventId === event.eventId && (now - lastClick.time) < 300;

                lastClickRef.current = { eventId: event.eventId, time: now };

                if (isDoubleClick && eventDeltas.length > 0) {
                    // Double-click: focus on sublist (like pressing Enter)
                    setHighlightedIndex(originalIndex);
                    setSublistFocused(true);
                    setSublistIndex(0);
                    const change = eventDeltas[0];
                    if (change) {
                      // TODOR:
                        // selectMrForChange(change);
                    }
                } else {
                    // Single click: just highlight
                    setHighlightedIndex(originalIndex);
                    setSublistFocused(false);
                    const change = eventDeltas[0];
                    if (change) {
                      //TODOR:
                        // selectMrForChange(change);
                    } else {
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
                    {!hasEventDeltas && (
                        <box height={1} width="100%" flexDirection="row" onMouseDown={handleEventClick}>
                            <text fg="#44475a" bg="#1e1f29">
                                {'      —'}
                            </text>
                            <box flexGrow={1} height={1} style={{ backgroundColor: '#1e1f29' }} />
                        </box>
                    )}
                    {eventDeltas.map((change, i) => {
                        const isSelected = isHighlighted && sublistFocused && i === sublistIndex;
                        const { badge, color: changeColor, text } = getChangeDescription(change);

                        const formattedDate = change.changedAt
                          ? formatRelativeTime(change.changedAt).padEnd(3, ' ')
                          : '?  ';
                        const dateColor = change.changedAt ? getAgeColor(change.changedAt, now) : Colors.SECONDARY;

                        return (
                            <box key={i} height={1} width="100%" flexDirection='row' onMouseDown={() => handleChangeClick(i, change)}>
                                <box width={4} flexShrink={0} height={1}>
                                    <text
                                        wrapMode='none'
                                        fg={dateColor}
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
