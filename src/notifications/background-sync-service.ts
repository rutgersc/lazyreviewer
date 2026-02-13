import { Context, Data, Effect, Layer, PubSub, Ref, Console, Stream } from 'effect';
import { Atom, Result } from '@effect-atom/atom-react';
import { settingsAtom, repoSelectionAtom } from '../settings/settings-atom';
import { resolveRepoPath } from '../userselection/userSelection';
import { fetchRepoPage, type KnownMrInfo } from '../mergerequests/decide-fetch-mrs';
import { SettingsService } from '../settings/settings';
import { BgSyncReadModelService, type MrFreshness } from './bg-sync-read-model';
import type { MrGid } from '../domain/identifiers';
import type { MergeRequestState } from '../domain/merge-request-state';
import { formatCompactTime } from '../utils/formatting';

export type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextSyncDate: Date; repoCount: number }
  | { _tag: 'syncing'; repoPath: string; page: number; repoCount: number }
  | { _tag: 'syncPerformed'; repoPath: string; page: number; repoCount: number }
  | { _tag: 'syncDisabled'; reason: 'settingDisabled' | 'noRepos'; syncIntervalSeconds: number };

export type PageSlotSnapshot = {
  readonly repo: string
  readonly page: number
  readonly minutesUntilRefresh: number
}

export class BackgroundSyncService extends Context.Tag("BackgroundSyncService")<
  BackgroundSyncService,
  {
    readonly statusPubSub: PubSub.PubSub<BackgroundSyncStatus>;
    readonly slotsPubSub: PubSub.PubSub<readonly PageSlotSnapshot[]>;
    readonly fetchLock: Ref.Ref<boolean>;
  }
>() {
  static Default = Layer.scoped(
    BackgroundSyncService,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<BackgroundSyncStatus>();
      const slotsPubSub = yield* PubSub.unbounded<readonly PageSlotSnapshot[]>();
      const fetchLock = yield* Ref.make(false);
      return { statusPubSub: pubsub, slotsPubSub, fetchLock };
    })
  );
}

export class FetchLockBusy extends Data.TaggedError("FetchLockBusy")<{}> {}

export const withFetchLock = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | FetchLockBusy, R | BackgroundSyncService> =>
  Effect.gen(function* () {
    const { fetchLock } = yield* BackgroundSyncService;
    const acquired = yield* Ref.modify(fetchLock, (busy) =>
      busy ? [false, true] as const : [true, true] as const
    );
    if (!acquired) return yield* new FetchLockBusy();
    return yield* effect.pipe(Effect.ensuring(Ref.set(fetchLock, false)));
  });

type PageSlot = {
  readonly repo: string
  readonly page: number
  readonly afterCursor: string | null
  lastFetchedAt: number | null
  intervalMs: number
  endCursor: string | null
  lastFetchedGids: ReadonlySet<MrGid>
}

export const computePageInterval = (baseIntervalMs: number, scalingFactorHours: number, newestUpdatedAt: Date): number => {
  const ageHours = (Date.now() - newestUpdatedAt.getTime()) / (1000 * 60 * 60)
  return baseIntervalMs * Math.max(1, 1 + Math.sqrt(ageHours / scalingFactorHours))
}

const formatDurationMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

const canFetch = (slot: PageSlot): boolean =>
  slot.page === 1 || slot.afterCursor !== null

const findMostOverdueSlot = (slots: ReadonlyMap<string, PageSlot>): PageSlot | null => {
  const now = Date.now()
  let best: PageSlot | null = null
  let bestOverdue = -Infinity

  for (const slot of slots.values()) {
    if (!canFetch(slot)) continue
    if (slot.lastFetchedAt === null) {
      return slot
    }
    const overdue = now - slot.lastFetchedAt - slot.intervalMs
    if (overdue > bestOverdue) {
      bestOverdue = overdue
      best = slot
    }
  }

  return bestOverdue > 0 ? best : null
}

const nextDueTime = (slots: ReadonlyMap<string, PageSlot>): number | null => {
  let earliest = Infinity
  for (const slot of slots.values()) {
    if (!canFetch(slot)) continue
    if (slot.lastFetchedAt === null) return 0
    const dueAt = slot.lastFetchedAt + slot.intervalMs
    if (dueAt < earliest) earliest = dueAt
  }
  return earliest === Infinity ? null : earliest
}

const slotKey = (repo: string, page: number) => `${repo}:${page}`

const computeRepoPageIntervals = (
  mrFreshnessById: ReadonlyMap<MrGid, MrFreshness>,
  repo: string,
  pageSize: number,
  baseIntervalMs: number,
  scalingFactorHours: number,
): readonly number[] =>
  [...mrFreshnessById.values()]
    .filter(f => f.repo === repo)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .reduce<Date[][]>((pages, f) => {
      const last = pages[pages.length - 1]
      if (!last || last.length >= pageSize) pages.push([f.updatedAt])
      else last.push(f.updatedAt)
      return pages
    }, [])
    .map(dates => computePageInterval(baseIntervalMs, scalingFactorHours, dates[0]!))

const syncSlotsWithSelection = (
  slots: Map<string, PageSlot>,
  selectedRepos: readonly string[],
  baseIntervalMs: number,
  scalingFactorHours: number,
  pageFetchTimestamps: Readonly<Record<string, readonly string[]>>,
  mrFreshnessById: ReadonlyMap<MrGid, MrFreshness>,
  pageSize: number,
): void => {
  const selectedSet = new Set(selectedRepos)

  for (const repo of selectedRepos) {
    const timestamps = pageFetchTimestamps[repo] ?? []
    const pageCount = Math.max(1, timestamps.length)
    const needsIntervals = !slots.has(slotKey(repo, 1))
    const intervals = needsIntervals
      ? computeRepoPageIntervals(mrFreshnessById, repo, pageSize, baseIntervalMs, scalingFactorHours)
      : []

    for (let page = 1; page <= pageCount; page++) {
      const key = slotKey(repo, page)
      if (!slots.has(key)) {
        const persisted = timestamps[page - 1]
        slots.set(key, {
          repo,
          page,
          afterCursor: null,
          lastFetchedAt: persisted ? new Date(persisted).getTime() : null,
          intervalMs: intervals[page - 1] ?? baseIntervalMs,
          endCursor: null,
          lastFetchedGids: new Set(),
        })
      }
    }
  }

  // Remove slots for deselected repos
  for (const [key, slot] of slots) {
    if (!selectedSet.has(slot.repo)) {
      slots.delete(key)
    }
  }
}

type SyncConfig = {
  enabled: boolean;
  repoPaths: readonly string[];
  baseIntervalMs: number;
  scalingFactorHours: number;
  syncIntervalSeconds: number;
};

const computeSyncConfig = (get: Atom.Context): SyncConfig => {
  const settingsResult = get.registry.get(settingsAtom);
  const settings = Result.match(settingsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value
  });

  const bg = settings?.backgroundSync;
  const syncIntervalSeconds = bg?.syncIntervalSeconds ?? 300;
  const scalingFactorHours = bg?.scalingFactorHours ?? 24;

  if (!settings || !bg?.enabled) {
    return { enabled: false, repoPaths: [], baseIntervalMs: syncIntervalSeconds * 1000, scalingFactorHours, syncIntervalSeconds };
  }

  const repoPaths = get.registry.get(repoSelectionAtom);
  return {
    enabled: repoPaths.length > 0,
    repoPaths,
    baseIntervalMs: syncIntervalSeconds * 1000,
    scalingFactorHours,
    syncIntervalSeconds,
  };
};

const getShallowerPageGids = (slots: ReadonlyMap<string, PageSlot>, repo: string, page: number): ReadonlySet<MrGid> => {
  const gids = new Set<MrGid>()
  for (let p = 1; p < page; p++) {
    const slot = slots.get(slotKey(repo, p))
    if (slot) {
      for (const gid of slot.lastFetchedGids) {
        gids.add(gid)
      }
    }
  }
  return gids
}

const repoShortName = (repoPath: string): string => {
  const parts = repoPath.split('/')
  return parts[parts.length - 1] ?? repoPath
}

const snapshotPageFetchTimestamps = (
  slots: ReadonlyMap<string, PageSlot>,
): Record<string, string[]> => {
  const result: Record<string, string[]> = {}
  for (const slot of slots.values()) {
    if (slot.lastFetchedAt === null) continue
    const arr = result[slot.repo] ??= []
    arr[slot.page - 1] = new Date(slot.lastFetchedAt).toISOString()
  }
  return result
}

const snapshotSlots = (slots: ReadonlyMap<string, PageSlot>): readonly PageSlotSnapshot[] => {
  const now = Date.now()
  return [...slots.values()].map(slot => ({
    repo: slot.repo,
    page: slot.page,
    minutesUntilRefresh: slot.lastFetchedAt === null
      ? 0
      : Math.max(0, Math.ceil((slot.lastFetchedAt + slot.intervalMs - now) / 60000)),
  }))
}

const buildKnownMrs = (
  mrFreshnessById: ReadonlyMap<MrGid, MrFreshness>,
  repo: string,
  state: MergeRequestState,
): ReadonlyMap<MrGid, KnownMrInfo> =>
  new Map(
    [...mrFreshnessById.entries()]
      .filter(([, f]) => f.repo === repo && f.state === state)
      .map(([gid, f]) => [gid, { projectPath: f.repo, iid: f.iid, updatedAt: f.updatedAt }])
  )

const createBackgroundWorker = (get: Atom.Context, pubsub: PubSub.PubSub<BackgroundSyncStatus>, slotsPub: PubSub.PubSub<readonly PageSlotSnapshot[]>) =>
  Effect.gen(function* () {
    yield* Console.log('[BackgroundSync] Daemon worker STARTED');

    const initialSettings = yield* SettingsService.load;
    let seedTimestamps: Readonly<Record<string, readonly string[]>> = initialSettings.backgroundSync?.pageFetchTimestamps ?? {};
    const lastKnownSeq = initialSettings.backgroundSync?.lastKnownSeq ?? 0;

    const { changes } = yield* BgSyncReadModelService;
    yield* changes.pipe(
      Stream.filter(state => state.seq >= lastKnownSeq),
      Stream.take(1),
      Stream.runDrain,
    );
    yield* Console.log(`[BackgroundSync] MR data ready (seq ${lastKnownSeq})`);

    const slots = new Map<string, PageSlot>()

    while (true) {
      const config = computeSyncConfig(get);

      if (!config.enabled) {
        const reason = config.repoPaths.length === 0 && config.baseIntervalMs > 0 ? 'noRepos' : 'settingDisabled'
        yield* PubSub.publish(pubsub, { _tag: 'syncDisabled', reason, syncIntervalSeconds: config.syncIntervalSeconds } as BackgroundSyncStatus);
        yield* PubSub.publish(slotsPub, []);
        yield* Effect.sleep('2 seconds');
        continue;
      }

      const bgState = yield* BgSyncReadModelService.get
      syncSlotsWithSelection(slots, config.repoPaths, config.baseIntervalMs, config.scalingFactorHours, seedTimestamps, bgState.mrFreshnessById, 20)
      yield* PubSub.publish(slotsPub, snapshotSlots(slots))

      const overdueSlot = findMostOverdueSlot(slots)

      if (!overdueSlot) {
        const due = nextDueTime(slots)
        if (due !== null) {
          const msUntilDue = Math.max(0, due - Date.now())
          yield* PubSub.publish(pubsub, {
            _tag: 'syncPending',
            nextSyncDate: new Date(due),
            repoCount: config.repoPaths.length,
          } as BackgroundSyncStatus);
          yield* Effect.sleep(`${Math.min(msUntilDue, 5000)} millis`);
        } else {
          yield* Effect.sleep('2 seconds');
        }
        continue;
      }

      yield* PubSub.publish(pubsub, {
        _tag: 'syncing',
        repoPath: overdueSlot.repo,
        page: overdueSlot.page,
        repoCount: config.repoPaths.length,
      } as BackgroundSyncStatus);

      yield* Effect.gen(function* () {
        const currentBgState = yield* BgSyncReadModelService.get
        const knownProjects = [...currentBgState.knownProjects.values()]
        const repo = resolveRepoPath(overdueSlot.repo, knownProjects)

        const shallowerGids = getShallowerPageGids(slots, overdueSlot.repo, overdueSlot.page)
        const knownMrs = buildKnownMrs(currentBgState.mrFreshnessById, overdueSlot.repo, 'opened')

        const result = yield* fetchRepoPage(repo, 'opened', knownMrs, overdueSlot.afterCursor, shallowerGids, 20)

        // Update slot state
        overdueSlot.lastFetchedAt = Date.now()
        overdueSlot.lastFetchedGids = result.fetchedGids
        overdueSlot.endCursor = result.endCursor

        overdueSlot.intervalMs = result.newestUpdatedAt
          ? computePageInterval(config.baseIntervalMs, config.scalingFactorHours, result.newestUpdatedAt)
          : config.baseIntervalMs

        // Discover or update next page
        if (result.hasNextPage) {
          const nextPageNum = overdueSlot.page + 1
          const nextKey = slotKey(overdueSlot.repo, nextPageNum)
          const existing = slots.get(nextKey)
          if (existing) {
            slots.set(nextKey, { ...existing, afterCursor: result.endCursor! })
          } else {
            const persisted = seedTimestamps[overdueSlot.repo]?.[nextPageNum - 1]
            const nextInterval = result.oldestUpdatedAt
              ? computePageInterval(config.baseIntervalMs, config.scalingFactorHours, result.oldestUpdatedAt)
              : config.baseIntervalMs
            slots.set(nextKey, {
              repo: overdueSlot.repo,
              page: nextPageNum,
              afterCursor: result.endCursor!,
              lastFetchedAt: persisted ? new Date(persisted).getTime() : null,
              intervalMs: nextInterval,
              endCursor: null,
              lastFetchedGids: new Set(),
            })
          }
        } else {
          for (let p = overdueSlot.page + 1; ; p++) {
            const k = slotKey(overdueSlot.repo, p)
            if (!slots.has(k)) break
            slots.delete(k)
          }
        }

        const ageStr = result.oldestUpdatedAt
          ? formatCompactTime(result.oldestUpdatedAt)
          : 'n/a'
        const intervalStr = formatDurationMs(overdueSlot.intervalMs)
        yield* Console.log(
          `[BackgroundSync] ${repoShortName(overdueSlot.repo)} page ${overdueSlot.page}: `
          + `${result.mrCount} MRs, oldest ${ageStr} ago → next refresh in ${intervalStr}`
        )

        const updatedTimestamps = snapshotPageFetchTimestamps(slots)
        seedTimestamps = updatedTimestamps
        const currentSeq = (yield* BgSyncReadModelService.get).seq
        yield* SettingsService.modify(s => ({
          ...s,
          backgroundSync: {
            ...s.backgroundSync!,
            lastRefreshTimestamp: new Date().toISOString(),
            lastKnownSeq: currentSeq,
            pageFetchTimestamps: updatedTimestamps,
          }
        }));

        yield* PubSub.publish(slotsPub, snapshotSlots(slots))
        yield* PubSub.publish(pubsub, {
          _tag: 'syncPerformed',
          repoPath: overdueSlot.repo,
          page: overdueSlot.page,
          repoCount: config.repoPaths.length,
        } as BackgroundSyncStatus);
      }).pipe(
        withFetchLock,
        Effect.catchTag("FetchLockBusy", () => Effect.void),
        Effect.catchAllCause((cause) => Console.error('[BackgroundSync] Fetch failed:', cause))
      );

      yield* Effect.sleep('5 seconds');
    }
  });

let workerStarted = false;

export const ensureBackgroundSyncWorker = (get: Atom.Context) =>
  Effect.gen(function* () {
    if (workerStarted) {
      yield* Console.warn('[BackgroundSync] Worker already running');
      return;
    }
    workerStarted = true;

    const service = yield* BackgroundSyncService;
    yield* Effect.forkDaemon(
      createBackgroundWorker(get, service.statusPubSub, service.slotsPubSub));
  });
