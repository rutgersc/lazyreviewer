import { Effect, Console } from 'effect';
import { Atom } from "effect/unstable/reactivity";
import { appAtomRuntime } from './appLayerRuntime';
import { ensureBackgroundSyncWorker } from './notifications/background-sync-service';
import { ensureNotificationDaemon } from './notifications/notification-sync-atom';
import { ensurePipelineJobPriorityInSettings } from './settings/settings-ensure-pipeline-jobnames-sink';
import { ensureDiscoveredUsersInSettings } from './settings/settings-ensure-users-sink';
import { ensureEventCleanupDaemon } from './eventstore/cleanup/event-cleanup-daemon';

export const appInitAtom = appAtomRuntime.atom(get =>
  Effect.gen(function* () {
    yield* Console.log('[AppInit] Ensuring all daemons are running');
    yield* Effect.all([
      ensurePipelineJobPriorityInSettings,
      ensureDiscoveredUsersInSettings,
      ensureBackgroundSyncWorker(get),
      ensureNotificationDaemon(get),
      ensureEventCleanupDaemon,
    ], { concurrency: 'unbounded' });
  }),
  { initialValue: undefined }
).pipe(Atom.keepAlive);
