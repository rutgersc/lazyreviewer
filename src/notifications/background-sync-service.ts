import { Context, Effect, Layer, PubSub, Stream, Console } from 'effect';
import { Atom, Result } from '@effect-atom/atom-react';
import { settingsAtom } from '../settings/settings-atom';
import { userSelectionsByIdAtom } from '../userselection/userselection-atom';
import { groupsAtom } from '../data/data-atom';
import { extractSelectionData, type UserSelectionEntry } from '../userselection/userSelection';
import { decideFetchUserMrs, decideFetchProjectMrs, type CacheKey } from '../mergerequests/decide-fetch-mrs';
import { modifySettings } from '../settings/settings';

export type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextRefreshDate: Date, userSelection: UserSelectionEntry }
  | { _tag: 'syncing', flattenedUserSelection: CacheKey, userSelection: UserSelectionEntry }
  | { _tag: 'syncPerformed', flattenedUserSelection: CacheKey, userSelection: UserSelectionEntry; duration: string }
  | { _tag: 'syncDisabled', reason: 'notificationSettingDisabled' | 'noMatchingSelection' };

export class BackgroundSyncService extends Context.Tag("BackgroundSyncService")<
  BackgroundSyncService,
  {
    readonly statusPubSub: PubSub.PubSub<BackgroundSyncStatus>;
  }
>() {
  static Default = Layer.scoped(
    BackgroundSyncService,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<BackgroundSyncStatus>();
      return { statusPubSub: pubsub };
    })
  );
}

const computeSyncStatus = (get: Atom.Context): { status: BackgroundSyncStatus } => {
  const settingsResult = get.registry.get(settingsAtom);
  const settings = Result.match(settingsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value
  });

  const userSelectionsById = get.registry.get(userSelectionsByIdAtom);
  const matchingSelection = settings?.backgroundSync.enabled
    ? userSelectionsById.get(settings.backgroundSync.syncUserSelectionEntryId!)
    : undefined;

  if (!settings || !settings.backgroundSync.enabled) {
    return { status: { _tag: 'syncDisabled', reason: 'notificationSettingDisabled' } };
  }

  if (!matchingSelection) {
    return { status: { _tag: 'syncDisabled', reason: 'noMatchingSelection' } };
  }

  const lastRefreshTimestamp = settings.backgroundSync.lastRefreshTimestamp;
  const syncIntervalMs = settings.backgroundSync.syncIntervalSeconds * 1000;
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
      const { status } = computeSyncStatus(get);

      switch (status._tag) {
        case 'syncDisabled':
          yield* PubSub.publish(pubsub, status);
          yield* Effect.sleep('30 seconds');
          break;

        case 'syncPending':
          yield* PubSub.publish(pubsub, status);
          const msUntilRefresh = status.nextRefreshDate.getTime() - Date.now();
          yield* Effect.sleep(`${Math.min(msUntilRefresh, 5000)} millis`);
          break;

        case 'syncing':
          yield* PubSub.publish(pubsub, status);
          yield* decideFetch(status.flattenedUserSelection);
          modifySettings(settings => ({
            ...settings,
            backgroundSync: { ...settings.backgroundSync, lastRefreshTimestamp: new Date().toISOString() }
          }));
          yield* PubSub.publish(pubsub, {
            _tag: 'syncPerformed',
            flattenedUserSelection: status.flattenedUserSelection,
            userSelection: status.userSelection,
            duration: "idk seconds"
          });
          yield* Effect.sleep('5 seconds');
          break;
      }
    }
  });
};

let workerStarted = false;

export const ensureBackgroundSyncWorker = (get: Atom.Context) =>
  Effect.gen(function* () {
    if (workerStarted) {
      yield* Console.warn('[BackgroundSync] Worker already running');
      return;
    }
    workerStarted = true;

    yield* Effect.forkDaemon(
      createBackgroundWorker(
        get,
        (yield* BackgroundSyncService).statusPubSub));
  });
