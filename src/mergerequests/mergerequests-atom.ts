import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "./mergerequest-schema";
import { repositoryFullPath, resolveRepoPath, type RepositoryId, type UserId, type User, isCurrentUser, mrProviderAuthor } from "../userselection/userSelection";
import {
  fetchRepoPage,
  extractKnownProjects,
  decideFetchUserMrs,
  decideFetchSingleMr,
  getKnownMrsForCacheKey,
  MRCacheKey,
  ProjectMRCacheKey,
} from "./decide-fetch-mrs";
import { EventStorage } from "../events/events";
import type { MergeRequestState } from "../domain/merge-request-state";
import { Effect, Console, Stream, Option } from "effect";
import { UnauthorizedError } from "../domain/unauthorized-error";
import { appAtomRuntime } from "../appLayerRuntime";
import type { BranchDifference } from "./hooks/useRepositoryBranches";
import { refetchMrPipeline } from './mergerequests-effects';
import { loadJiraTicketsAsEvent } from '../jira/jira-service';
import type { JiraIssue } from "../jira/jira-service";
import { mrSortOrderAtom, repoSelectionAtom, userFilterUsernamesAtom, userFilterGroupIdsAtom } from "../settings/settings-atom";
import { SettingsService } from "../settings/settings";
import { sprintFilterIssueKeysAtom } from "../jiraboard/sprint-issues-atom";
import { groupsAtom, usersAtom } from "../data/data-atom";
import { resolveGroupIds } from "../userselection/userSelection";
import { allEventsAtom } from "../events/events-atom";
import type { LazyReviewerEvent } from "../events/events";
import { allMrsProjection } from "./all-mergerequests-projection";
import type { MrSortOrder } from "../settings/settings";
import { MrStateService } from "./mr-state-service";
import type { MrGid } from "../domain/identifiers";

export const selectedMrIndexAtom = Atom.make<number>(0);

// Transient repo filter for MR display (empty = show all synced repos)
export const repoFilterAtom = Atom.make<readonly string[]>([]);

export const selectedMrAtom = Atom.make(get =>  {
    const selectedMrIndex = get(selectedMrIndexAtom);
    const mergeRequestsResult = get(mergeRequestsAtom);

    if (Result.isResult(mergeRequestsResult)) {
        return Result.match(mergeRequestsResult, {
            onInitial: () => undefined,
            onSuccess: (success) => success.value[selectedMrIndex],
            onFailure: () => undefined
        });
    }

    return undefined;
})

export const branchDifferencesAtom = Atom.make<Map<string, BranchDifference>>(new Map());

export const filterMrStateAtom = Atom.make<MergeRequestState>('opened');

export { mrSortOrderAtom } from "../settings/settings-atom";
export type { MrSortOrder } from "../settings/settings";

export const allMrsAtom = appAtomRuntime.atom(
  (get) => MrStateService.changes.pipe(Stream.unwrap),
  { initialValue: allMrsProjection.initialState }
).pipe(Atom.keepAlive);

export const allMrSourceBranchesByProjectAtom = Atom.map(
  allMrsAtom,
  (result) =>
    Result.match(result, {
      onInitial: () => new Map<string, ReadonlySet<string>>(),
      onSuccess: (success) => {
        const map = new Map<string, Set<string>>();
        for (const mr of success.value.mrsByGid.values()) {
          const existing = map.get(mr.project.fullPath);
          if (existing) existing.add(mr.sourcebranch);
          else map.set(mr.project.fullPath, new Set([mr.sourcebranch]));
        }
        return map as ReadonlyMap<string, ReadonlySet<string>>;
      },
      onFailure: () => new Map<string, ReadonlySet<string>>()
    })
);

export const allJiraIssuesAtom = Atom.map(
  allMrsAtom,
  (result) =>
    Result.match(result, {
      onInitial: () => new Map<string, JiraIssue>(),
      onSuccess: (success) => success.value.jiraIssuesByKey,
      onFailure: () => new Map<string, JiraIssue>()
    })
);

// Unique authors across all fetched MRs, enriched with settings user info
export const knownAuthorsAtom = Atom.make((get): readonly UserId[] => {
  const allMrsResult = get(allMrsAtom);
  const settingsUsers = get(usersAtom);
  const gitlabToUser = new Map(settingsUsers.filter((u): u is User => u.type === 'user').map(u => [u.id.gitlab, u.id]));
  const bitbucketToUser = new Map(settingsUsers.filter((u): u is User => u.type === 'user').map(u => [u.id.bitbucket, u.id]));
  return Result.match(allMrsResult, {
    onInitial: () => [] as UserId[],
    onSuccess: (state) => {
      const seen = new Map<string, UserId>();
      for (const mr of state.value.mrsByGid.values()) {
        if (!seen.has(mr.author)) {
          const lookup = mr.provider === 'gitlab' ? gitlabToUser : bitbucketToUser;
          const known = lookup.get(mr.author);
          seen.set(mr.author, known ?? { type: 'userId', userId: mr.author, [mr.provider]: mr.author });
        }
      }
      return [...seen.values()].sort((a, b) => a.userId.localeCompare(b.userId));
    },
    onFailure: () => [] as UserId[]
  });
});

// Unique project paths across all fetched MRs
export const knownProjectsAtom = Atom.make((get): readonly RepositoryId[] => {
  const allMrsResult = get(allMrsAtom);
  return Result.match(allMrsResult, {
    onInitial: () => [] as RepositoryId[],
    onSuccess: (state) =>
      [...extractKnownProjects(state.value.mrsByGid)]
        .sort((a, b) => repositoryFullPath(a).localeCompare(repositoryFullPath(b))),
    onFailure: () => [] as RepositoryId[]
  });
});

export const effectiveUserFilterAtom = Atom.make((get): readonly UserId[] => {
  const userIds = get(userFilterUsernamesAtom);
  const groupIds = get(userFilterGroupIdsAtom);
  if (userIds.length === 0 && groupIds.length === 0) return [];
  const groups = get(groupsAtom);
  const settingsUsers = get(usersAtom);
  const userLookup = new Map(settingsUsers.filter((u): u is User => u.type === 'user').map(u => [u.id.userId, u.id]));
  const groupUsers = resolveGroupIds(groupIds, groups);
  const directUsers = userIds.map(id => userLookup.get(id) ?? { type: 'userId' as const, userId: id });
  const seen = new Set<string>();
  return [...groupUsers, ...directUsers].filter(u => {
    if (seen.has(u.userId)) return false;
    seen.add(u.userId);
    return true;
  });
});

const mrMatchesUserFilter = (mr: MergeRequest, userFilter: readonly UserId[]): boolean =>
  userFilter.length === 0 || userFilter.some(u => isCurrentUser(u, mrProviderAuthor(mr.provider, mr.author)));

const filterMrs = (
  allMrs: ReadonlyMap<MrGid, MergeRequest>,
  state: MergeRequestState,
  repoFilter: readonly string[],
  userFilter: readonly UserId[],
  sortOrder: MrSortOrder,
  sprintIssueKeys: ReadonlySet<string>,
): readonly MergeRequest[] => {
  const repoFilterSet = new Set(repoFilter);
  return [...allMrs.values()]
    .filter(mr => mr.state === state)
    .filter(mr => repoFilterSet.size === 0 || repoFilterSet.has(mr.project.fullPath))
    .filter(mr => mrMatchesUserFilter(mr, userFilter))
    .filter(mr => sprintIssueKeys.size === 0 || mr.jiraIssueKeys.some(key => sprintIssueKeys.has(key)))
    .sort((a, b) => b[sortOrder].getTime() - a[sortOrder].getTime());
};

export const filteredMrsAtom = Atom.make((get) => {
  const repoFilter = get(repoFilterAtom);
  const filterMrState = get(filterMrStateAtom);
  const sortOrder = get(mrSortOrderAtom);
  const userFilter = get(effectiveUserFilterAtom);
  const sprintIssueKeys = get(sprintFilterIssueKeysAtom);
  const allMrsResult = get(allMrsAtom);

  return Result.match(allMrsResult, {
    onInitial: () => [] as readonly MergeRequest[],
    onSuccess: (state) => filterMrs(state.value.mrsByGid, filterMrState, repoFilter, userFilter, sortOrder, sprintIssueKeys),
    onFailure: () => [] as readonly MergeRequest[]
  });
});

// Alias for backwards compatibility
export const mergeRequestsAtom = Atom.make((get) => Result.success(get(filteredMrsAtom)));
export const unwrappedMergeRequestsAtom = filteredMrsAtom;

// Find the last refresh timestamp for the current selection + state
export const lastRefreshTimestampAtom = Atom.make((get): Date | null => {
  const filterMrState = get(filterMrStateAtom);
  const events = Result.match(get(allEventsAtom), {
    onInitial: () => [] as LazyReviewerEvent[],
    onSuccess: (e) => e.value,
    onFailure: () => [] as LazyReviewerEvent[]
  });

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;

    if (event.type === 'gitlab-project-mrs-fetched-event') {
      if (event.forState === filterMrState) {
        return new Date(event.timestamp);
      }
    }
  }

  return null;
});

export const unwrappedLastRefreshTimestampAtom = lastRefreshTimestampAtom;

// Derived: compute loading state
export const isMergeRequestsLoadingAtom = Atom.make((get): boolean => {
  const refreshResult = get(refreshMergeRequestsAtom);
  return Result.isWaiting(refreshResult);
});

export const refreshMergeRequestsAtom = appAtomRuntime.fn((_, get) => {
    return Effect.gen(function* () {
      const repoFilter = get(repoFilterAtom);
      const repoPaths = repoFilter.length > 0 ? repoFilter : get(repoSelectionAtom);
      if (repoPaths.length === 0) return;

      const filterMrState = get(filterMrStateAtom);

      const allMrsResult = get(allMrsAtom);
      const allMrs = Result.match(allMrsResult, {
        onInitial: () => new Map<MrGid, MergeRequest>(),
        onSuccess: (state) => state.value.mrsByGid,
        onFailure: () => new Map<MrGid, MergeRequest>()
      });

      const knownProjects = get(knownProjectsAtom);
      const repos = repoPaths
        .map(path => resolveRepoPath(path, knownProjects));

      const userFilter = get(effectiveUserFilterAtom);
      const gitlabRepos = repos.filter(r => r.provider === 'gitlab');
      const bitbucketRepos = repos.filter(r => r.provider === 'bitbucket');

      const hasUserFilter = userFilter.length > 0;

      if (hasUserFilter && gitlabRepos.length > 0) {
        yield* Console.log(`[Refresh] Fetching ${filterMrState} MRs for users [${userFilter.map(u => u.gitlab ?? u.userId).join(', ')}] (first page)`);
        const cacheKey = new MRCacheKey({ users: [...userFilter], state: filterMrState });
        const knownMrs = getKnownMrsForCacheKey(allMrs, cacheKey);
        const discoveredPaths = yield* decideFetchUserMrs([...userFilter], filterMrState, knownMrs).pipe(
          Effect.catchTag("UnauthorizedError", (e) => Effect.die(e)),
          Effect.catchAllCause((cause) => Console.error("Error fetching user MRs:", cause).pipe(Effect.as([] as readonly string[])))
        );
        if (discoveredPaths.length > 0) {
          yield* SettingsService.modify(s => {
            const updated = { ...s.repositoryPaths };
            let changed = false;
            for (const path of discoveredPaths) {
              if (!(path in updated)) {
                updated[path] = { localPath: '', remoteName: 'origin' };
                changed = true;
              }
            }
            return changed ? { ...s, repositoryPaths: updated } : s;
          });
        }
      } else {
        if (gitlabRepos.length > 0) {
          yield* Console.log(`[Refresh] Fetching ${filterMrState} MRs for ${gitlabRepos.length} GitLab repos: [${gitlabRepos.map(repositoryFullPath).join(', ')}] (first page, max 50 per repo)`);
        }
        yield* Effect.forEach(
          gitlabRepos,
          (repo) => {
            const knownMrs = getKnownMrsForCacheKey(allMrs, new ProjectMRCacheKey({ repository: repo, state: filterMrState }));
            return fetchRepoPage(repo, filterMrState, knownMrs, null);
          },
          { concurrency: 3 }
        ).pipe(
          Effect.catchTag("UnauthorizedError", (e) => Effect.die(e)),
          Effect.catchAllCause((cause) => Console.error("Error fetching GitLab project MRs:", cause))
        );
      }

      if (bitbucketRepos.length > 0) {
        yield* Console.log(`[Refresh] Fetching ${filterMrState} PRs for ${bitbucketRepos.length} Bitbucket repos: [${bitbucketRepos.map(repositoryFullPath).join(', ')}]`);
      }
      yield* Effect.forEach(
        bitbucketRepos,
        (repo) => {
          const knownMrs = getKnownMrsForCacheKey(allMrs, new ProjectMRCacheKey({ repository: repo, state: filterMrState }));
          return fetchRepoPage(repo, filterMrState, knownMrs, null);
        },
        { concurrency: 3 }
      ).pipe(
        Effect.catchTag("UnauthorizedError", (e) => Effect.die(e)),
        Effect.catchAllCause((cause) => Console.error("Error fetching Bitbucket project MRs:", cause))
      );
    });
  }
)

export const refetchSelectedMrPipelineAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const mergeRequests = yield* Result.toExit(get(mergeRequestsAtom));

    const selectedMrIndex = get(selectedMrIndexAtom);
    const selectedMr = mergeRequests[selectedMrIndex];
    if (!selectedMr) {
      yield* Console.log('[Pipeline] No MR selected');
      return;
    }

    yield* Console.log(`[Pipeline] Refetching pipeline for MR !${selectedMr.iid}`);

    yield* refetchMrPipeline(
      selectedMr.id,
      selectedMr.project.fullPath,
      selectedMr.iid,
    );

    yield* Console.log(`[Pipeline] Pipeline refetch complete for MR !${selectedMr.iid} (cache updates now handled by atoms)`);
  })
);

export const refetchSelectedMrAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const mergeRequests = yield* Result.toExit(get(mergeRequestsAtom));
    const selectedMrIndex = get(selectedMrIndexAtom);
    const selectedMr = mergeRequests[selectedMrIndex];

    if (!selectedMr) {
      yield* Console.log('[RefetchMR] No MR selected');
      return null;
    }

    const gitlabMr = yield* decideFetchSingleMr(selectedMr.project.fullPath, selectedMr.iid);
    if (gitlabMr) {
      const jiraKeys = gitlabMr.jiraIssueKeys;
      if (jiraKeys.length > 0) {
        const jiraEvent = yield* loadJiraTicketsAsEvent(jiraKeys);
        yield* EventStorage.appendEvent(jiraEvent);
      }
    }

    yield* Console.log(`[RefetchMR] Refreshed MR !${selectedMr.iid}`);
    return gitlabMr;
  })
);

type MrFilterState = {
  filterMrState: MergeRequestState;
  repoFilter: readonly string[];
  userFilterUsernames: readonly string[];
  userFilterGroupIds: readonly string[];
};

type MrFilterHistory = {
  before: MrFilterState | null;
  after: MrFilterState;
};

const strArraysEqual = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const filterStatesEqual = (a: MrFilterState, b: MrFilterState) =>
  a.filterMrState === b.filterMrState &&
  strArraysEqual(a.repoFilter, b.repoFilter) &&
  strArraysEqual(a.userFilterUsernames, b.userFilterUsernames) &&
  strArraysEqual(a.userFilterGroupIds, b.userFilterGroupIds);

export const mrFilterHistoryAtom = Atom.make((get): MrFilterHistory => {
  const after: MrFilterState = {
    filterMrState: get(filterMrStateAtom),
    repoFilter: get(repoFilterAtom),
    userFilterUsernames: get(userFilterUsernamesAtom),
    userFilterGroupIds: get(userFilterGroupIdsAtom),
  };

  const previous = get.self<MrFilterHistory>();
  return Option.match(previous, {
    onNone: () => ({ before: null, after }),
    onSome: (prev) =>
      filterStatesEqual(prev.after, after)
        ? prev
        : { before: prev.after, after },
  });
});

export type SelectMrByIdParams = {
  mrId: string;
};

export const selectMrByIdAtom = Atom.writable(
  () => undefined as string | undefined,
  (ctx, params: SelectMrByIdParams) => {
    const { mrId } = params;

    const filteredMrs = ctx.get(filteredMrsAtom);
    const mrIndex = filteredMrs.findIndex(mr => mr.id === mrId);

    if (mrIndex >= 0) {
      ctx.set(selectedMrIndexAtom, mrIndex);
      return;
    }

    const allMrsResult = ctx.get(allMrsAtom);
    const allMrsState = Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    });
    if (!allMrsState) return;

    const mr = Array.from(allMrsState.mrsByGid.values()).find(m => m.id === mrId);
    if (!mr) return;

    const newState = mr.state as MergeRequestState;
    const sortOrder = ctx.get(mrSortOrderAtom);
    const rFilter = new Set(ctx.get(repoFilterAtom));
    const userFilter = ctx.get(effectiveUserFilterAtom);

    ctx.set(filterMrStateAtom, newState);
    const newFilteredMrs = Array.from(allMrsState.mrsByGid.values())
      .filter(m => m.state === newState)
      .filter(m => rFilter.size === 0 || rFilter.has(m.project.fullPath))
      .filter(m => mrMatchesUserFilter(m, userFilter))
      .sort((a, b) => b[sortOrder].getTime() - a[sortOrder].getTime());
    const newMrIndex = newFilteredMrs.findIndex(m => m.id === mrId);
    ctx.set(selectedMrIndexAtom, newMrIndex >= 0 ? newMrIndex : 0);
  }
);

export const selectMrByBranchAtom = Atom.writable(
  () => undefined,
  (ctx, params: { projectPath: string; branch: string }) => {
    const allMrsResult = ctx.get(allMrsAtom);
    const mr = Result.match(allMrsResult, {
      onInitial: () => undefined,
      onFailure: () => undefined,
      onSuccess: (state) =>
        Array.from(state.value.mrsByGid.values()).find(
          m => m.project.fullPath === params.projectPath && m.sourcebranch === params.branch
        )
    });
    if (mr) ctx.set(selectMrByIdAtom, { mrId: mr.id });
  }
);
