import { Atom, Result } from '@effect-atom/atom-react';
import { Effect, Stream, Console, Option, PubSub, Fiber } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { settingsAtom, currentUserAtom } from '../settings/settings-atom';
import { userSelectionsByIdAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { extractSelectionData, type UserSelectionEntry } from '../userselection/userSelection';
import { decideFetchUserMrs, decideFetchProjectMrs, type CacheKey } from '../mergerequests/decide-fetch-mrs';
import { changesStream, type ChangeTrackingState } from '../changetracking/change-tracking-atom';
import { sendSystemNotification, type NotificationPayload } from './notification-service';
import { loadSettings, modifySettings, saveSettings } from '../settings/settings';
import { incrementUnreadCount } from './title-indicator';
import { defaultNotificationPreferences, type NotificationContext, type NotifiableChange, determineNotification, type NotificationFilterResult } from './notification-filter';
import { allMrsAtom } from '../mergerequests/mergerequests-atom';

export type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextRefreshDate: Date, userSelection: UserSelectionEntry }
  | { _tag: 'syncing', flattenedUserSelection: CacheKey, userSelection: UserSelectionEntry }
  | { _tag: 'syncPerformed', flattenedUserSelection: CacheKey, userSelection: UserSelectionEntry; duration: string }
  | { _tag: 'syncDisabled', reason: 'notificationSettingDisabled' | 'noMatchingSelection' };

// Module-level singleton state for background worker
let workerState: {
  pubsub: PubSub.PubSub<BackgroundSyncStatus>;
  fiber: Fiber.RuntimeFiber<never, never>;
} | undefined;

/**
 * Computes the current sync status based on settings.
 * Returns the status and whether a fetch should be performed.
 */
const computeSyncStatus = (get: Atom.Context): {
  status: BackgroundSyncStatus;
} => {
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

  if (!settings || !settings.notifications.enabled) {
    return { status: { _tag: 'syncDisabled', reason: 'notificationSettingDisabled' } };
  }

  if (!matchingSelection) {
    return { status: { _tag: 'syncDisabled', reason: 'noMatchingSelection' } };
  }

  const lastRefreshTimestamp = settings.notifications.lastRefreshTimestamp;
  const syncIntervalMs = settings.notifications.syncIntervalSeconds * 1000;
  const now = Date.now();

  const lastRefreshTime = lastRefreshTimestamp
    ? new Date(lastRefreshTimestamp).getTime()
    : 0;

  const timeUntilNextRefresh = syncIntervalMs - (now - lastRefreshTime);
  if (timeUntilNextRefresh > 0) {
    return {
      status: {
        _tag: 'syncPending',
        nextRefreshDate: new Date(lastRefreshTime + syncIntervalMs),
        userSelection: matchingSelection
      } satisfies BackgroundSyncStatus
    };
  }

  const groups = get.registry.get(groupsAtom);
  const cacheKey = extractSelectionData(matchingSelection, groups, 'opened');

  return {
    status: {
      _tag: 'syncing',
      flattenedUserSelection: cacheKey,
      userSelection: matchingSelection
    } satisfies BackgroundSyncStatus
  };
};

/**
 * Creates the background worker daemon that publishes to PubSub.
 * Only one worker runs regardless of how many subscribers.
 */
const createBackgroundWorker = (get: Atom.Context, pubsub: PubSub.PubSub<BackgroundSyncStatus>) => {
  const decideFetch = (matchingSelection: CacheKey) =>
    Effect.catchAllCause(
      matchingSelection._tag === 'UserMRs'
        ? decideFetchUserMrs(matchingSelection.usernames as string[], 'opened')
        : decideFetchProjectMrs(matchingSelection.projectPath, 'opened'),
      (cause) => Console.error('[BackgroundSync] Fetch failed:', cause)
    );

  return Effect.gen(function* () {
    yield* Console.log('[BackgroundSync] Daemon worker STARTED');

    while (true) {

      console.log("this doesnt get hit start")
      const { status } = computeSyncStatus(get);

      console.log("broooezn")

      switch (status._tag)
      {
        case 'syncDisabled':
          yield* PubSub.publish(pubsub, status);
          const sleepTime = status._tag === 'syncDisabled' ? '30 seconds' : '5 seconds';
          yield* Effect.sleep(sleepTime);
          break;

        case 'syncPending':
          yield* PubSub.publish(pubsub, status);
          break;

        case 'syncing':
          yield* PubSub.publish(pubsub, status);
          yield* decideFetch(status.flattenedUserSelection);
          modifySettings(settings => ({
            ...settings,
            notifications: { ...settings.notifications, lastRefreshTimestamp: new Date().toISOString() }
          }));
          yield* PubSub.publish(pubsub, {
            _tag: 'syncPerformed',
            flattenedUserSelection: status.flattenedUserSelection,
            userSelection: status.userSelection,
            duration: "idk seconds"
          });
          yield* Effect.sleep('5 seconds');
          break;

        case 'syncPerformed':
          // TODO: this is a bit iffy
          break;
      }
    }
  });
};

const ensureBackgroundWorker = (get: Atom.Context) =>
  Effect.gen(function* () {
    console.log("triggered")
    if (workerState) {
      yield* Console.log('[BackgroundSync] Worker already running, reusing PubSub');
      return workerState.pubsub;
    }

    yield* Console.log('[BackgroundSync] Starting new background worker daemon');
    const pubsub = yield* PubSub.unbounded<BackgroundSyncStatus>();
    const fiber = yield* Effect.forkDaemon(createBackgroundWorker(get, pubsub));

    workerState = { pubsub, fiber };
    return pubsub;
  });

/**
 * Background fetch stream - subscribes to the singleton daemon's PubSub.
 */
const backgroundFetchStream = Effect.fn("backgroundFetchStream")(function* (get: Atom.Context) {
  const pubsub = yield* ensureBackgroundWorker(get);
  return Stream.fromPubSub(pubsub);
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
