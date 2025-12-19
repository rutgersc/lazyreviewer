import { Effect, Console } from 'effect';
import { Atom } from '@effect-atom/atom-react';
import { appAtomRuntime } from './appLayerRuntime';
import { ensureBackgroundSyncWorker } from './notifications/background-sync-service';
import { ensureNotificationDaemon } from './notifications/notification-sync-atom';

export const appInitAtom = appAtomRuntime.atom(get =>
  Effect.gen(function* () {
    yield* Console.log('[AppInit] Ensuring all daemons are running');
    yield* Effect.all([
      ensureBackgroundSyncWorker(get),
      ensureNotificationDaemon(get)
    ], { concurrency: 'unbounded' });
  }),
  { initialValue: undefined }
).pipe(Atom.keepAlive);
