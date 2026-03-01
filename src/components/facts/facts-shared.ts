import { Atom, Result } from '@effect-atom/atom-react';
import { allEventsAtom } from '../../events/events-atom';
import { resultToArray } from '../../utils/result-helpers';
import { eventChangesReadmodelAtom } from '../../changetracking/change-tracking-atom';
import type { Change } from '../../changetracking/change-tracking-projection';
import { isMrChange, type MrInfo } from '../../changetracking/mr-change-tracking-projection';
import type { LazyReviewerEvent } from '../../events/events';
import { allMrsAtom, unwrappedMergeRequestsAtom, selectMrByIdAtom } from '../../mergerequests/mergerequests-atom';
import { appViewAtom, currentUserIdAtom } from '../../settings/settings-atom';
import { isCurrentUser, mrProviderAuthor } from '../../userselection/userSelection';
import { viewConfigs } from '../../ui/view-config';
import { infoPaneTabAtom } from '../../ui/navigation-atom';
import { targetNoteIdAtom } from '../ActivityLog';
import { useDiscussionScroll } from '../../hooks/useDiscussionScroll';
import { useJiraScroll } from '../../hooks/useJiraScroll';
import { selectedJiraIndexAtom, selectedJiraSubIndexAtom } from '../JiraIssuesList';

// --- Pure functions ---

export function getJiraPrefix(change: Change): string {
  if (isMrChange(change)) {
    const key = change.mr.jiraIssueKeys[0];
    return key ? `${key} ` : '';
  }
  if (change.type === 'new-jira-issue' || change.type === 'jira-status-changed' || change.type === 'jira-comment') {
    return `${change.issue.issueKey} `;
  }
  return '';
}

export function getChangeDescription(change: Change): { color: string; text: string } {
  const jira = getJiraPrefix(change);
  const mrAuthorName = (mr: MrInfo): string =>
    mr.mrAuthor.provider === 'jira' ? mr.mrAuthor.accountId : mr.mrAuthor.username;

  switch (change.type) {
    case 'new-mr':
      return { color: '#50fa7b', text: `${jira}New MR: ${change.mr.mrName} (${mrAuthorName(change.mr)})` };
    case 'merged-mr':
      return { color: '#bd93f9', text: `${jira}Merged: ${change.mr.mrName}` };
    case 'closed-mr':
      return { color: '#ff5555', text: `${jira}Closed: ${change.mr.mrName}` };
    case 'reopened-mr':
      return { color: '#ffb86c', text: `${jira}Reopened: ${change.mr.mrName}` };
    case 'system-note':
      return { color: '#6272a4', text: `${jira}${change.authorDisplayName}: ${change.body.slice(0, 50)}${change.body.length > 50 ? '...' : ''}` };
    case 'system-notes-compacted': {
      const author = change.authorDisplayNames[0];
      switch (change.systemNoteType) {
        case 'commits-added':
          return { color: '#6272a4', text: `${jira}${author}: added ${change.count} commits` };
        case 'approved':
          return { color: '#6272a4', text: `${jira}${author}: approved this merge request ${change.count} times` };
        case 'mentioned-in-mr':
          return { color: '#6272a4', text: `${jira}${author}: mentioned in ${change.count} merge requests` };
        default:
          return { color: '#6272a4', text: `${jira}${author}: ${change.count} system notes` };
      }
    }
    case 'diff-comment': {
      const lineInfo = change.line ? `:${change.line}` : '';
      const fileName = change.filePath.split('/').pop() ?? change.filePath;
      return { color: '#8be9fd', text: `${jira}${change.authorDisplayName} on ${fileName}${lineInfo}` };
    }
    case 'discussion-comment':
      return { color: '#ffb86c', text: `${jira}${change.authorDisplayName} commented on ${change.mr.mrName}` };
    case 'new-jira-issue':
      return { color: '#50fa7b', text: `${jira}New Jira: ${change.issue.summary}` };
    case 'jira-status-changed':
      return { color: '#bd93f9', text: `${jira}${change.fromStatus ? `${change.fromStatus} → ` : ''}${change.toStatus}` };
    case 'jira-comment':
      return { color: '#8be9fd', text: `${jira}${change.authorDisplayName} commented` };
    default: {
      const _: never = change;
      throw new Error("unreachable");
    }
  }
}

export function getNoteIdFromChange(change: Change): string | undefined {
  switch (change.type) {
    case 'system-note':
    case 'diff-comment':
    case 'discussion-comment':
      return change.noteId;
    default:
      return undefined;
  }
}

export function formatRelativeTime(date: Date, now: Date): string {
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
}

// --- Types ---

export interface EventGroup {
  type: 'single' | 'range';
  startIndex: number;
  endIndex: number;
  event: LazyReviewerEvent;
}

export type ClassifiedEvent = {
  event: LazyReviewerEvent;
  originalIndex: number;
  grouping: 'single' | 'range';
};

// --- Helpers ---

export const emptyChange: Change[] = [];

const emptyDeltasByEventId = new Map<string, Change[]>();

export const groupClassifiedEvents = (events: ClassifiedEvent[]): EventGroup[] =>
  events.reduce<EventGroup[]>((groups, { event, originalIndex, grouping }) => {
    if (grouping === 'single') {
      return [...groups, { type: 'single', startIndex: originalIndex, endIndex: originalIndex, event }];
    }

    const lastGroup = groups[groups.length - 1];
    const canContinue = lastGroup?.type === 'range' && lastGroup.startIndex === originalIndex + 1;

    if (canContinue) {
      return [...groups.slice(0, -1), { ...lastGroup, startIndex: originalIndex }];
    }

    return [...groups, { type: 'range', startIndex: originalIndex, endIndex: originalIndex, event }];
  }, []);

// --- Atoms ---

export const myJiraIssueKeysAtom = Atom.readable<Set<string>>((get) => {
  const currentUser = get(currentUserIdAtom);
  const allMrsResult = get(allMrsAtom);
  return Result.match(allMrsResult, {
    onInitial: () => new Set<string>(),
    onSuccess: (state) => new Set(
      Array.from(state.value.mrsByGid.values())
        .filter(mr => isCurrentUser(currentUser, mrProviderAuthor(mr.provider, mr.author)))
        .flatMap(mr => mr.jiraIssueKeys)
    ),
    onFailure: () => new Set<string>(),
  });
});

export const sublistFocusedAtom = Atom.make(false);
export const sublistIndexAtom = Atom.make(0);
export const highlightedIndexAtom = Atom.make<number | null>(null);

export const scrollToEventIdRequestAtom = Atom.make<string | null>(null);
export const statusMessageAtom = Atom.make<string | null>(null);

export const displayEventsAtom = Atom.readable((get) => {
});

export const groupedDeltasByEventIdAtom = Atom.readable((get) => {
  const eventChangesReadmodel = get(eventChangesReadmodelAtom);

  return eventChangesReadmodel.pipe(
    Result.map(v => v.groupedDeltasByEventId),
    Result.getOrElse(() => emptyDeltasByEventId)
  );
});

export const currentEventChangesAtom = Atom.readable<Change[]>(get => {
  const allEvents = resultToArray(get(allEventsAtom));
  const highlightedIndex = get(highlightedIndexAtom);

  const currentEventIndex = highlightedIndex ?? allEvents.length - 1;
  const currentEvent = allEvents[currentEventIndex];

  const groupedDeltas = get(groupedDeltasByEventIdAtom);
  return [...(groupedDeltas.get(currentEvent?.eventId ?? "") ?? emptyChange)].reverse();
});

export const groupedEventsAtom = Atom.readable<EventGroup[]>((get) => {
  const allEvents = resultToArray(get(allEventsAtom));
  const groupedDeltas = get(groupedDeltasByEventIdAtom);
  const displayEvents = [...allEvents].reverse().slice(0, 50);

  const hasVisibleDeltas = (ev: LazyReviewerEvent): boolean =>
    (groupedDeltas.get(ev.eventId) ?? emptyChange).length > 0;

  const classified: ClassifiedEvent[] = displayEvents
    .map((event, displayIndex) => {
      if (!event) return null;
      const originalIndex = allEvents.length - 1 - displayIndex;
      return { event, originalIndex, grouping: hasVisibleDeltas(event) ? 'single' as const : 'range' as const };
    })
    .filter((e): e is ClassifiedEvent => e !== null);

  return groupClassifiedEvents(classified);
});

export const chronologicalChangesAtom = Atom.readable<Change[]>((get) => {
  const groupedDeltas = get(groupedDeltasByEventIdAtom);
  return Array.from(groupedDeltas.values())
    .flat()
    .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
    .slice(0, 200);
});

export const viewConfigAtom = Atom.readable((get) => viewConfigs[get(appViewAtom)]);

export const selectMrForChangeAtom = Atom.fnSync((change: Change, get) => {
  const selectMrAndNavigate = (mrId: string, noteId?: string, navigateTo?: 'overview' | 'activity') => {
    get.registry.set(selectMrByIdAtom, { mrId });

    if (noteId && navigateTo) {
      get.registry.set(infoPaneTabAtom, navigateTo);
      if (navigateTo === 'activity') {
        get.registry.set(targetNoteIdAtom, noteId);
      }
      if (navigateTo === 'overview') {
        const { scroll } = useDiscussionScroll();
        void scroll(noteId);
      }
    }
  };

  if (isMrChange(change)) {
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
