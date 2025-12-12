import { Atom, Result } from '@effect-atom/atom-react';
import { Effect, Stream, Console, Option } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { settingsAtom, currentUserAtom } from '../settings/settings-atom';
import { userSelectionsByIdAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { extractSelectionData, type UserSelectionEntry } from '../userselection/userSelection';
import { decideFetchUserMrs, decideFetchProjectMrs } from '../mergerequests/decide-fetch-mrs';
import { changesStream, type ChangeTrackingState } from '../changetracking/change-tracking-atom';
import { sendSystemNotification, type NotificationPayload } from './notification-service';
import { loadSettings, saveSettings } from '../settings/settings';
import { incrementUnreadCount } from './title-indicator';
import { defaultNotificationPreferences, type NotificationContext, type NotifiableChange, determineNotification, type NotificationFilterResult } from './notification-filter';
import { allMrsAtom } from '../mergerequests/mergerequests-atom';

export type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextRefreshDate: Date, userSelection: UserSelectionEntry }
  | { _tag: 'syncPerformed' }
  | { _tag: 'syncDisabled' };

// Module-level semaphore (mutex) to ensure only one sync loop iteration runs at a time
const syncLoopMutex = Effect.unsafeMakeSemaphore(1);

// Debug: track stream instances
let streamInstanceCounter = 0;

/**
 * Computes the current sync status based on settings.
 * Returns the status and whether a fetch should be performed.
 */
const computeSyncStatus = (get: Atom.Context): { status: BackgroundSyncStatus; shouldFetch: boolean; matchingSelection?: ReturnType<typeof extractSelectionData> extends infer T ? T : never } => {
  const settingsResult = get.registry.get(settingsAtom);
  const settings = Result.match(settingsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value
  });

  const userSelectionsById = get.registry.get(userSelectionsByIdAtom);
  const matchingSelection = settings?.notifications.enabled
    ? userSelectionsById.get(settings.notifications.syncUserSelectionEntryId!)
    : undefined;

  if (!settings || !settings.notifications.enabled || !matchingSelection) {
    return { status: { _tag: 'syncDisabled' }, shouldFetch: false };
  }

  // Use loadSettings() directly to get fresh data from disk
  const freshSettings = loadSettings();
  const lastRefreshTimestamp = freshSettings.notifications.lastRefreshTimestamp;
  const syncIntervalMs = settings.notifications.syncIntervalSeconds * 1000;
  const now = Date.now();

  const lastRefreshTime = lastRefreshTimestamp
    ? new Date(lastRefreshTimestamp).getTime()
    : 0;

  const timeUntilNextRefresh = syncIntervalMs - (now - lastRefreshTime);

  const syncPending = {
    _tag: 'syncPending',
    nextRefreshDate: new Date(lastRefreshTime + syncIntervalMs),
    userSelection: matchingSelection
  } satisfies BackgroundSyncStatus;

  if (timeUntilNextRefresh > 0) {
    return {
      status: syncPending,
      shouldFetch: false
    };
  }

  const groups = get.registry.get(groupsAtom);
  const cacheKey = extractSelectionData(matchingSelection, groups, 'opened');

  return {
    status: syncPending,
    shouldFetch: true,
    matchingSelection: cacheKey
  };
};

/**
 * Background fetch scheduler - emits BackgroundSyncStatus every 5 seconds.
 * Uses a mutex to ensure only one iteration runs at a time across all instances.
 */
const backgroundFetchStream = Effect.fn("backgroundFetchStream")(function* (get: Atom.Context) {
  const instanceId = ++streamInstanceCounter;
  yield* Console.log(`[BackgroundSync] Stream instance #${instanceId} CREATED`);

  // Register finalizer to log when this stream instance is disposed
  get.addFinalizer(() => {
    console.log(`[BackgroundSync] Stream instance #${instanceId} DISPOSED`);
  });

  return Stream.repeatEffect(
    // Wrap entire iteration in mutex - if another instance is running, this one waits
    syncLoopMutex.withPermits(1)(
      Effect.gen(function* () {
        const { status, shouldFetch, matchingSelection } = computeSyncStatus(get);

        if (!shouldFetch) {
          const sleepTime = status._tag === 'syncDisabled' ? '30 seconds' : '5 seconds';
          yield* Effect.sleep(sleepTime);
          return status;
        }

        // Time to perform the fetch
        yield* Console.log(`[BackgroundSync] Fetching MRs...`);

        yield* Effect.catchAllCause(
          matchingSelection!._tag === 'UserMRs'
            ? decideFetchUserMrs(matchingSelection!.usernames as string[], 'opened')
            : decideFetchProjectMrs(matchingSelection!.projectPath, 'opened'),
          (cause) => Console.error('[BackgroundSync] Fetch failed:', cause)
        );

        // Update the lastRefreshTimestamp in settings
        const currentSettings = loadSettings();
        currentSettings.notifications.lastRefreshTimestamp = new Date().toISOString();
        saveSettings(currentSettings);

        // Sleep before next check
        yield* Effect.sleep('5 seconds');

        return { _tag: 'syncPerformed' } as BackgroundSyncStatus;
      })
    )
  );
});

export const backgroundFetchAtom = appAtomRuntime.atom(
  (get) => Stream.unwrap(backgroundFetchStream(get)),
  { initialValue: { _tag: 'syncDisabled' } as BackgroundSyncStatus }
).pipe(Atom.keepAlive);


const buildNotificationContext = (get: Atom.Context): NotificationContext => {
  const currentUser = get.registry.get(currentUserAtom);
  const allMrsResult = get.registry.get(allMrsAtom);

  const mrs = Result.match(allMrsResult, {
    onInitial: () => [] as const,
    onFailure: () => [] as const,
    onSuccess: (state) => [...state.value.mrsByGid.values()]
  });

  const participatedDiscussionIds = new Set(
    mrs.flatMap(mr =>
      mr.discussions
        .filter(d => d.notes.some(note => note.author === currentUser))
        .map(d => d.id)
    )
  );

  const relatedJiraIssueKeys = new Set(
    mrs.flatMap(mr => mr.jiraIssueKeys)
  );

  return {
    currentUser,
    participatedDiscussionIds,
    relatedJiraIssueKeys,
    preferences: defaultNotificationPreferences
  };
};

const processStateChangeToNotification = (acc: ChangeTrackingState, get: Atom.Context) => {
  return Effect.gen(function* () {
    if (!acc.event) return;

    const deltas = acc.deltasByEventId.get(acc.event.eventId);
    if (!deltas || deltas.length === 0) return;

    // Update last processed event ID
    const currentSettings = loadSettings();
    currentSettings.notifications.lastProcessedEventId = acc.event.eventId;
    saveSettings(currentSettings);

    // Check if notifications are enabled
    const settingsResult = get.registry.get(settingsAtom);
    const notificationsEnabled = Result.match(settingsResult, {
      onInitial: () => false,
      onFailure: () => false,
      onSuccess: (s) => s.value.notifications.enabled
    });

    if (!notificationsEnabled) return;

    // Build context and filter notifiable changes
    const context = buildNotificationContext(get);
    const notifiableChanges = deltas
      .map(change => determineNotification(change, context))
      .filter((result): result is Extract<NotificationFilterResult, { notify: true }> => result.notify)
      .map(change => change.change);

    if (notifiableChanges.length === 0) return;

    const createNotification = (changes: NotifiableChange[]): NotificationPayload => {
      const formatChange = (change: NotifiableChange) => {
        switch (change.type) {
          case 'new-mr': return { title: `🔔 ${change.mr.mrAuthor} created MR ${change.mr.mrName}`, body: `[NEW MR] ${change.mr.mrName}` };
          case 'merged-mr': return { title: `🔔 ${change.mr.mrName} merged`, body: `[MERGED MR] ${change.mr.mrName}` };
          case 'closed-mr': return { title: `🔔 ${change.mr.mrName} closed`, body: `[CLOSED MR] ${change.mr.mrName}` };
          case 'reopened-mr': return { title: `🔔 ${change.mr.mrName} got reopened`, body: `[REOPENED MR] ${change.mr.mrName}` };
          case 'diff-comment': return { title: `🔔 ${change.author} commented on ${change.mr.mrName}`, body: `[DIFF COMMENT] ${change.mr.mrName}` };
          case 'discussion-comment': return { title: `🔔 ${change.author} commented on ${change.mr.mrName}`, body: `[DISCUSSION COMMENT] ${change.mr.mrName}` };
          case 'jira-comment': return { title: `🔔 ${change.author} commented on ${change.issue.issueKey}`, body: `[JIRA COMMENT] ${change.issue.issueKey}` };
          case 'jira-status-changed': return { title: `🔔 status of ${change.issue.issueKey} changed to ${change.toStatus}`, body: `[JIRA STATUS CHANGED] ${change.issue.issueKey}` };
        }
      }

      const newMrs = changes.filter(c => c.type === 'new-mr').length;
      const mergedMrs = changes.filter(c => c.type === 'merged-mr').length;
      const closedMrs = changes.filter(c => c.type === 'closed-mr').length;
      const reopenedMrs = changes.filter(c => c.type === 'reopened-mr').length;
      const diffComments = changes.filter(c => c.type === 'diff-comment').length;
      const discussionComments = changes.filter(c => c.type === 'discussion-comment').length;
      const jiraComments = changes.filter(c => c.type === 'jira-comment').length;
      const jiraStatusChanged = changes.filter(c => c.type === 'jira-status-changed').length;

      if (changes.length === 1) {
        return formatChange(changes[0]!);
      }

      if (changes.length < 5) {
        return {
          title: "New changes",
          body: changes.map(formatChange).join('\n')
        };
      }

      return {
        title: "New changes",
        body: `${newMrs} new MRs, \n
${mergedMrs} merged MRs, \n
${closedMrs} closed MRs, \n
${reopenedMrs} reopened MRs, \n
${diffComments} diff comments, \n
${discussionComments} discussion comments, \n
${jiraComments} JIRA comments, \n
${jiraStatusChanged} JIRA status changes`
      }
    };

    yield* sendSystemNotification(createNotification(notifiableChanges));
    incrementUnreadCount(notifiableChanges.length);
  })
}

const notificationStream = Effect.fn("notificationStream")(function* (get: Atom.Context) {
  const settings = loadSettings();
  const lastProcessedTimestamp = settings.notifications.lastProcessedEventId;

  return (yield* changesStream(get)).pipe(
    Stream.dropUntil(acc => !lastProcessedTimestamp || acc.event?.eventId === lastProcessedTimestamp),
    Stream.tap((acc) => processStateChangeToNotification(acc, get))
  );
});

export const notificationStreamAtom = appAtomRuntime.atom(
  (get) => Stream.unwrap(notificationStream(get)),
  { initialValue: undefined }
).pipe(Atom.keepAlive);
