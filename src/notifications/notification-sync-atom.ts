import { Atom, Result } from '@effect-atom/atom-react';
import { Effect, Stream, Console } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { settingsAtom } from '../settings/settings-atom';
import { userSelectionsByIdAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { extractSelectionData } from '../userselection/userSelection';
import { decideFetchUserMrs, decideFetchProjectMrs } from '../mergerequests/decide-fetch-mrs';
import { changesStream } from '../changetracking/change-tracking-atom';
import { sendBatchNotification } from './notification-service';
import { loadSettings, saveSettings } from '../settings/settings';
import { isNewMr } from '../changetracking/change-tracking-projection';
import { incrementUnreadCount } from './title-indicator';

/**
 * Background fetch scheduler - periodically fetches MRs for configured syncUserSelectionEntryId
 */
const backgroundFetchStream = Effect.fn("backgroundFetchStream")(function* (get: Atom.Context) {
  return Stream.repeatEffect(
    Effect.gen(function* () {
      const settingsResult = get.registry.get(settingsAtom);
      const settings = Result.match(settingsResult, {
        onInitial: () => null,
        onFailure: () => null,
        onSuccess: (s) => s.value
      });

      if (!settings || !settings.notifications.enabled) {
        yield* Effect.sleep('30 seconds');
        return;
      }

      const syncUserSelectionEntryId = settings.notifications.syncUserSelectionEntryId;
      if (!syncUserSelectionEntryId) {
        yield* Console.error('[BackgroundSync] syncUserSelectionEntryId not configured');
        yield* Effect.sleep('30 seconds');
        return;
      }

      const userSelectionsById = get.registry.get(userSelectionsByIdAtom);
      const matchingSelection = userSelectionsById.get(syncUserSelectionEntryId);

      if (!matchingSelection) {
        yield* Console.error(`[BackgroundSync] No userSelection for id "${syncUserSelectionEntryId}"`);
        yield* Effect.sleep('30 seconds');
        return;
      }

      const groups = get.registry.get(groupsAtom);
      const cacheKey = extractSelectionData(matchingSelection, groups, 'opened');

      yield* Console.log(`[BackgroundSync] Fetching MRs for "${matchingSelection.name}"`);

      yield* Effect.catchAllCause(
        cacheKey._tag === 'UserMRs'
          ? decideFetchUserMrs(cacheKey.usernames as string[], 'opened')
          : decideFetchProjectMrs(cacheKey.projectPath, 'opened'),
        (cause) => Console.error('[BackgroundSync] Fetch failed:', cause)
      );

      yield* Effect.sleep(`${settings.notifications.syncIntervalSeconds} seconds`);
    })
  );
});

export const backgroundFetchAtom = appAtomRuntime.atom(
  (get) => Stream.unwrap(backgroundFetchStream(get)),
  { initialValue: undefined }
).pipe(Atom.keepAlive);

/**
 * Notification stream - subscribes to changesStream and sends notifications
 */
const notificationStream = Effect.fn("notificationStream")(function* (get: Atom.Context) {
  // Get last processed event timestamp from settings
  const settings = loadSettings();
  const lastProcessedTimestamp = settings.notifications.lastProcessedEventTimestamp;

  yield* Console.log(`[Notifications] Starting, last processed: ${lastProcessedTimestamp ?? 'none'}`);

  return (yield* changesStream(get)).pipe(
    // Filter out events we've already processed
    Stream.filter((acc) => {
      if (!lastProcessedTimestamp) return true; // Process all if no history
      if (!acc.event) return false; // Skip events without timestamp
      return acc.event.timestamp > lastProcessedTimestamp; // Only process new events
    }),
    Stream.tap((acc) =>
      Effect.gen(function* () {
        if (!acc.event) return;

        // Count changes from the state's deltas
        const newCommentsCount = [...acc.state.mrs.values()].reduce(
          (sum, mr) => sum + mr.commentsDelta.size, 0
        );
        const newMrsCount = [...acc.state.mrs.values()].filter(isNewMr).length;

        // Always update the last processed timestamp
        const currentSettings = loadSettings();
        currentSettings.notifications.lastProcessedEventTimestamp = acc.event.timestamp;
        saveSettings(currentSettings);

        if (newCommentsCount === 0 && newMrsCount === 0) return;

        // Check if notifications are enabled
        const settingsResult = get.registry.get(settingsAtom);
        const notificationsEnabled = Result.match(settingsResult, {
          onInitial: () => false,
          onFailure: () => false,
          onSuccess: (s) => s.value.notifications.enabled
        });

        if (!notificationsEnabled) return;

        yield* Console.log(`[Notifications] Sending for event ${acc.event.timestamp}: ${newMrsCount} MRs, ${newCommentsCount} comments`);
        yield* sendBatchNotification(newMrsCount, newCommentsCount);
        incrementUnreadCount(newMrsCount + newCommentsCount);
      })
    )
  );
});

export const notificationStreamAtom = appAtomRuntime.atom(
  (get) => Stream.unwrap(notificationStream(get)),
  { initialValue: undefined }
).pipe(Atom.keepAlive);
