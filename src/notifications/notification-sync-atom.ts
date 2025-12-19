import { Atom, Result } from '@effect-atom/atom-react';
import { Effect, Stream, Console, Fiber, Chunk, Option } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { settingsAtom, currentUserAtom } from '../settings/settings-atom';
import { changesStream, type ChangeTrackingState } from '../changetracking/change-tracking-atom';
import { isMrChangeTrackingRelevantEvent, isJiraChangeTrackingRelevantEvent } from '../changetracking/change-tracking-projection';
import { sendSystemNotification, type NotificationPayload } from './notification-service';
import { loadSettings, saveSettings } from '../settings/settings';
import { incrementUnreadCount } from './title-indicator';
import { defaultNotificationPreferences, type NotificationContext, type NotifiableChange, determineNotification, type NotificationFilterResult } from './notification-filter';
import { allMrsAtom } from '../mergerequests/mergerequests-atom';
import { BackgroundSyncService, type BackgroundSyncStatus } from './background-sync-service';

// Re-export for consumers
export type { BackgroundSyncStatus } from './background-sync-service';

// Module-level singleton state for notification daemon
let notificationDaemonFiber: Fiber.RuntimeFiber<void, unknown> | undefined;

/**
 * Background fetch atom - subscribes to the service's status stream.
 */
export const backgroundFetchAtom = appAtomRuntime.atom(
  (_get) => Effect.map(
    BackgroundSyncService,
    (service) => Stream.fromPubSub(service.statusPubSub)
  ).pipe(Stream.unwrap),
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

const createNotificationDaemon = (get: Atom.Context) =>
  Effect.gen(function* () {
    yield* Console.log('[NotificationDaemon] Starting');

    const settings = loadSettings();
    const lastProcessedTimestamp = settings.notifications.lastProcessedEventId;

    const stream = (yield* changesStream(get)).pipe(
      Stream.groupedWithin(3000, "2 seconds"),
      Stream.dropUntil(acc => {
        if (!lastProcessedTimestamp) {
          return true; // stop drop
        }

        const hasLastProcessedEvent = acc.pipe(
          Chunk.findFirst(change => change.event?.eventId == lastProcessedTimestamp),
          Option.isSome);

        console.log(`[NotificationDaemon] stop dropping events? hasLastProcessedEvent: ${hasLastProcessedEvent}, lastProcessedTimestamp: ${lastProcessedTimestamp}`)

        return hasLastProcessedEvent; // if has the event, stop dropping
      }),
      Stream.tap((acc) => {
        return Effect.gen(function* () {
          // Find the last event of each type to ensure we notify for both MR and Jira changes
          const lastMrEventState = acc.pipe(
            Chunk.findLast(state => state.event !== undefined && isMrChangeTrackingRelevantEvent(state.event))
          );
          const lastJiraEventState = acc.pipe(
            Chunk.findLast(state => state.event !== undefined && isJiraChangeTrackingRelevantEvent(state.event))
          );

          // The actual last event (for persisting lastProcessedEventId)
          const actualLastState = acc.pipe(Chunk.last);

          yield* Console.log(`[NotificationDaemon] Processing - lastMr: ${Option.isSome(lastMrEventState)}, lastJira: ${Option.isSome(lastJiraEventState)}`);

          // Process each event type's deltas (avoiding duplicates if same event is both MR and Jira)
          const processedEventIds = new Set<string>();

          if (Option.isSome(lastMrEventState) && lastMrEventState.value.event) {
            processedEventIds.add(lastMrEventState.value.event.eventId);
            yield* processStateChangeToNotification(lastMrEventState.value, get);
          }

          if (Option.isSome(lastJiraEventState) && lastJiraEventState.value.event) {
            const eventId = lastJiraEventState.value.event.eventId;
            if (!processedEventIds.has(eventId)) {
              yield* processStateChangeToNotification(lastJiraEventState.value, get);
            }
          }

          // Persist the actual last event ID
          if (Option.isSome(actualLastState) && actualLastState.value.event) {
            const currentSettings = loadSettings();
            currentSettings.notifications.lastProcessedEventId = actualLastState.value.event.eventId;
            saveSettings(currentSettings);
          }
        })
      })
    );

    yield* Stream.runDrain(stream);
  });

export const ensureNotificationDaemon = (get: Atom.Context) =>
  Effect.gen(function* () {
    if (notificationDaemonFiber) {
      return;
    }

    yield* Console.log('[NotificationDaemon] Forking daemon');
    notificationDaemonFiber = yield* Effect.forkDaemon(createNotificationDaemon(get));
  });
