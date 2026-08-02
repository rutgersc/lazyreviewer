import { Data, Effect, ServiceMap, PubSub, Ref, Console } from 'effect';
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { settingsAtom, repoSelectionAtom } from '../settings/settings-atom';
import { resolveRepoPath, type RepositoryId } from '../userselection/userSelection';
import { fetchRepoPage, fetchMrDetails, extractKnownProjects, type KnownMrInfo } from '../mergerequests/decide-fetch-mrs';
import { SettingsService } from '../settings/settings';
import { MrStateService } from '../mergerequests/mr-state-service';
import { getMrStampsPage, type MrStampsPage } from '../gitlab/gitlab-graphql';
import { stampOfMergeRequest, stampOfNode, type MrStamp } from '../mergerequests/mr-stamp';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { MrGid } from '../domain/identifiers';

export type BackgroundSyncStatus =
  | { _tag: 'syncPending'; nextSyncDate: Date; repoCount: number }
  | { _tag: 'sweeping'; repoPath: string; repoCount: number }
  | { _tag: 'syncPerformed'; repoPath: string; observed: number; fetched: number; repoCount: number }
  | { _tag: 'syncDisabled'; reason: 'settingDisabled' | 'noRepos'; syncIntervalSeconds: number };

export type RepoSyncSnapshot = {
  readonly repo: string
  readonly mrCount: number
  /** Epoch ms the next sweep becomes due; null until the repo has been swept once. Absolute so
   *  the display can count down between publishes without drifting. */
  readonly nextRefreshAt: number | null
  readonly isSweeping: boolean
  /** The repo the loop will pick next, so "which one is coming" is visible, not just "when". */
  readonly isNext: boolean
}

export class BackgroundSyncService extends ServiceMap.Service<BackgroundSyncService, {
  readonly statusPubSub: PubSub.PubSub<BackgroundSyncStatus>;
  readonly snapshotsPubSub: PubSub.PubSub<readonly RepoSyncSnapshot[]>;
  readonly fetchLock: Ref.Ref<boolean>;
}>()("BackgroundSyncService", {
  make: Effect.gen(function* () {
    const statusPubSub = yield* PubSub.unbounded<BackgroundSyncStatus>();
    const snapshotsPubSub = yield* PubSub.unbounded<readonly RepoSyncSnapshot[]>();
    const fetchLock = yield* Ref.make(false);
    return { statusPubSub, snapshotsPubSub, fetchLock };
  })
}) {}

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

const SWEEP_PAGE_SIZE = 100
const RETRY_DELAY_MS = 60_000

type ObservedMr = { readonly iid: string; readonly stamp: MrStamp }

// A sweep only means something if it runs to completion: an MR missing from a partial sweep is
// unobserved, not gone. Any page failure aborts the whole sweep rather than yielding a diff.
const sweepGitlabRepo = (projectPath: string) => Effect.gen(function* () {
  const observed = new Map<MrGid, ObservedMr>()
  let after: string | null = null
  let pages = 0

  while (true) {
    const page: MrStampsPage = yield* getMrStampsPage(projectPath, 'opened', after, SWEEP_PAGE_SIZE)
    pages++
    page.nodes.forEach(node => observed.set(MrGid(node.id), { iid: node.iid, stamp: stampOfNode(node) }))

    if (!page.hasNextPage || !page.endCursor) break
    after = page.endCursor
  }

  return { observed, pages }
})

const openMrsInRepo = (mrsByGid: ReadonlyMap<MrGid, MergeRequest>, projectPath: string) =>
  [...mrsByGid.entries()].filter(([, mr]) => mr.project.fullPath === projectPath && mr.state === 'opened')

const heldStamps = (
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>,
  projectPath: string
): ReadonlyMap<MrGid, ObservedMr> =>
  new Map(
    openMrsInRepo(mrsByGid, projectPath)
      .map(([gid, mr]) => [gid, { iid: mr.iid, stamp: stampOfMergeRequest(mr) }])
  )

const heldKnownMrs = (
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>,
  projectPath: string
): ReadonlyMap<MrGid, KnownMrInfo> =>
  new Map(
    openMrsInRepo(mrsByGid, projectPath)
      .map(([gid, mr]) => [gid, { projectPath: mr.project.fullPath, iid: mr.iid, updatedAt: mr.updatedAt }])
  )

// Changed stamp, never seen before, or held-but-absent — an absent MR needs a fetch to learn
// whether it merged, closed, or is gone, which is the only way to find out.
const iidsToFetch = (
  observed: ReadonlyMap<MrGid, ObservedMr>,
  held: ReadonlyMap<MrGid, ObservedMr>
): readonly string[] => {
  const iids = new Set<string>()
  observed.forEach((mr, gid) => { if (held.get(gid)?.stamp !== mr.stamp) iids.add(mr.iid) })
  held.forEach((mr, gid) => { if (!observed.has(gid)) iids.add(mr.iid) })
  return [...iids]
}

const repoShortName = (repoPath: string): string => repoPath.split('/').pop() ?? repoPath

const syncRepo = (
  repository: RepositoryId,
  projectPath: string,
  mrsByGid: ReadonlyMap<MrGid, MergeRequest>
) => Effect.gen(function* () {
  // Bitbucket returns whole PRs in one unpaged request, so there is no cheaper stamp to fetch —
  // its list call is both tiers at once.
  if (repository.provider === 'bitbucket') {
    const result = yield* fetchRepoPage(repository, 'opened', heldKnownMrs(mrsByGid, projectPath), null)
    return { observed: result.mrCount, fetched: result.mrCount }
  }

  const { observed, pages } = yield* sweepGitlabRepo(repository.id)
  const iids = iidsToFetch(observed, heldStamps(mrsByGid, projectPath))

  yield* Console.log(
    `[BackgroundSync] ${repoShortName(projectPath)}: ${observed.size} open MRs in ${pages} page(s), ${iids.length} changed`
  )

  yield* fetchMrDetails(repository.id, iids)

  return { observed: observed.size, fetched: iids.length }
})

type SyncConfig = {
  enabled: boolean;
  repoPaths: readonly string[];
  intervalMs: number;
  syncIntervalSeconds: number;
};

const computeSyncConfig = (get: Atom.Context): SyncConfig => {
  const settingsResult = get.registry.get(settingsAtom);
  const settings = AsyncResult.match(settingsResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value
  });

  const bg = settings?.backgroundSync;
  const syncIntervalSeconds = bg?.syncIntervalSeconds ?? 300;

  if (!settings || !bg?.enabled) {
    return { enabled: false, repoPaths: [], intervalMs: syncIntervalSeconds * 1000, syncIntervalSeconds };
  }

  const repoPaths = get.registry.get(repoSelectionAtom);
  return { enabled: repoPaths.length > 0, repoPaths, intervalMs: syncIntervalSeconds * 1000, syncIntervalSeconds };
};

const pickDueRepo = (
  repoPaths: readonly string[],
  nextEligibleAt: ReadonlyMap<string, number>
): string | null => {
  const now = Date.now()
  return repoPaths
    .filter(repo => (nextEligibleAt.get(repo) ?? 0) <= now)
    .reduce<string | null>((earliest, repo) =>
      earliest === null || (nextEligibleAt.get(repo) ?? 0) < (nextEligibleAt.get(earliest) ?? 0)
        ? repo
        : earliest,
      null)
}

const nextDueAt = (repoPaths: readonly string[], nextEligibleAt: ReadonlyMap<string, number>): number =>
  Math.min(...repoPaths.map(repo => nextEligibleAt.get(repo) ?? 0))

const snapshotRepos = (
  repoPaths: readonly string[],
  nextEligibleAt: ReadonlyMap<string, number>,
  mrCounts: ReadonlyMap<string, number>,
  sweepingRepo: string | null
): readonly RepoSyncSnapshot[] => {
  const upNext = repoPaths
    .filter(repo => repo !== sweepingRepo)
    .reduce<string | null>((earliest, repo) =>
      earliest === null || (nextEligibleAt.get(repo) ?? 0) < (nextEligibleAt.get(earliest) ?? 0)
        ? repo
        : earliest,
      null)

  return repoPaths.map(repo => ({
    repo,
    mrCount: mrCounts.get(repo) ?? 0,
    nextRefreshAt: nextEligibleAt.get(repo) ?? null,
    isSweeping: repo === sweepingRepo,
    isNext: repo === upNext,
  }))
}

const createBackgroundWorker = (
  get: Atom.Context,
  statusPub: PubSub.PubSub<BackgroundSyncStatus>,
  snapshotsPub: PubSub.PubSub<readonly RepoSyncSnapshot[]>
) =>
  Effect.gen(function* () {
    yield* Console.log('[BackgroundSync] Sweep worker STARTED');

    const settingsService = yield* SettingsService;
    const mrStateService = yield* MrStateService;

    // The read model replays the persisted log in batches, so it is still filling for a second or
    // two after startup. Diffing a sweep against a half-replayed map reports every MR as unknown
    // and refetches the whole repo, every launch. Wait for it to stop growing first.
    yield* Effect.gen(function* () {
      let previousSize = -1
      while (true) {
        const { mrsByGid } = yield* mrStateService.get
        if (mrsByGid.size === previousSize) break
        previousSize = mrsByGid.size
        yield* Effect.sleep('500 millis')
      }
      yield* Console.log(`[BackgroundSync] Read model settled at ${previousSize} MRs`)
    })

    const nextEligibleAt = new Map<string, number>()
    const mrCounts = new Map<string, number>()

    while (true) {
      const config = computeSyncConfig(get);

      if (!config.enabled) {
        const reason = config.repoPaths.length === 0 && config.intervalMs > 0 ? 'noRepos' : 'settingDisabled'
        yield* PubSub.publish(statusPub, { _tag: 'syncDisabled', reason, syncIntervalSeconds: config.syncIntervalSeconds } as BackgroundSyncStatus);
        yield* PubSub.publish(snapshotsPub, []);
        yield* Effect.sleep('2 seconds');
        continue;
      }

      yield* PubSub.publish(snapshotsPub, snapshotRepos(config.repoPaths, nextEligibleAt, mrCounts, null));

      const dueRepo = pickDueRepo(config.repoPaths, nextEligibleAt)

      if (dueRepo === null) {
        const due = nextDueAt(config.repoPaths, nextEligibleAt)
        yield* PubSub.publish(statusPub, {
          _tag: 'syncPending',
          nextSyncDate: new Date(due),
          repoCount: config.repoPaths.length,
        } as BackgroundSyncStatus);
        yield* Effect.sleep(`${Math.min(Math.max(0, due - Date.now()), 5000)} millis`);
        continue;
      }

      yield* PubSub.publish(statusPub, {
        _tag: 'sweeping',
        repoPath: dueRepo,
        repoCount: config.repoPaths.length,
      } as BackgroundSyncStatus);
      yield* PubSub.publish(snapshotsPub, snapshotRepos(config.repoPaths, nextEligibleAt, mrCounts, dueRepo));

      const swept = yield* Effect.gen(function* () {
        const { mrsByGid } = yield* mrStateService.get
        const repository = resolveRepoPath(dueRepo, extractKnownProjects(mrsByGid))
        return yield* syncRepo(repository, dueRepo, mrsByGid)
      }).pipe(
        withFetchLock,
        Effect.catchTag("FetchLockBusy", () => Effect.succeed(null)),
        Effect.catchCause((cause) =>
          Console.error('[BackgroundSync] Sweep failed:', cause).pipe(Effect.as(null))
        )
      );

      if (swept === null) {
        // Failed or lock-blocked: stay behind the retry delay instead of spinning on the repo.
        nextEligibleAt.set(dueRepo, Date.now() + Math.min(RETRY_DELAY_MS, config.intervalMs))
        yield* PubSub.publish(snapshotsPub, snapshotRepos(config.repoPaths, nextEligibleAt, mrCounts, null));
        continue;
      }

      nextEligibleAt.set(dueRepo, Date.now() + config.intervalMs)
      mrCounts.set(dueRepo, swept.observed)

      yield* settingsService.modify(s => ({
        ...s,
        backgroundSync: {
          ...s.backgroundSync!,
          lastRefreshTimestamp: new Date().toISOString(),
        }
      }));

      yield* PubSub.publish(snapshotsPub, snapshotRepos(config.repoPaths, nextEligibleAt, mrCounts, null));
      yield* PubSub.publish(statusPub, {
        _tag: 'syncPerformed',
        repoPath: dueRepo,
        observed: swept.observed,
        fetched: swept.fetched,
        repoCount: config.repoPaths.length,
      } as BackgroundSyncStatus);
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
    yield* Effect.forkDetach(
      createBackgroundWorker(get, service.statusPubSub, service.snapshotsPubSub));
  });
