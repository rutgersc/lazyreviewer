import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "./mergerequest-schema";
import { extractSelectionData } from "../userselection/userSelection";
import {
  type CacheKey,
  decideFetchUserMrs,
  decideFetchProjectMrs
} from "./decide-fetch-mrs";
import {
  initialOpenMrsTrackingState,
  projectOpenMrsAndDetectMissing,
  OpenMrsTrackingState
} from "./mr-diff-tracking";
import { EventStorage } from "../events/events";
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { Effect, Console, Stream, Chunk } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import type { BranchDifference } from "./hooks/useRepositoryBranches";
import { refetchMrPipeline } from './mergerequests-effects';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { JiraIssue } from "../jira/jira-service";
import { selectedUserSelectionEntryAtom, userSelectionsAtom } from "../userselection/userselection-atom";
import { groupsAtom } from "../data/data-atom";
import { AllMrsState, projectAllMrs, isMrRelevantEvent } from "./all-mergerequests-projection";

export const selectedMrIndexAtom = Atom.make<number>(0);

export const selectedMrAtom = Atom.make(get =>  {
    const selectedMrIndex = get(selectedMrIndexAtom);
    const mergeRequestsResult = get(mergeRequestsAtom);

    if (Result.isResult(mergeRequestsResult)) {
        return Result.match(mergeRequestsResult, {
            onInitial: () => undefined,
            onSuccess: (success) => success.value[selectedMrIndex],
            onFailure: (failure) => undefined
        });
    }

    return undefined;
})

export const branchDifferencesAtom = Atom.make<Map<string, BranchDifference>>(new Map());

export const filterMrStateAtom = Atom.make<MergeRequestState>('opened');

export const selectedDiscussionIndexAtom = Atom.make<number>(0);

export const allMrsAtom = appAtomRuntime.atom(
  (get) => {
    return Stream.unwrap(
      Effect.gen(function* () {
        return (yield* EventStorage.eventsStream).pipe(
          Stream.filter(isMrRelevantEvent),
          Stream.groupedWithin(100, "0.15 seconds"),
          Stream.scan(
            new AllMrsState({ mrsByGid: new Map(), jiraIssuesByKey: new Map(), timestamp: new Date() }),
            (state: AllMrsState, events) =>
              Chunk.reduce(events, state, (currentState, event) => projectAllMrs(currentState, event))
          )
        );
      })
    );
  },
  { initialValue: new AllMrsState({ mrsByGid: new Map(), jiraIssuesByKey: new Map(), timestamp: new Date() }) }
).pipe(Atom.keepAlive);

export const allJiraIssuesAtom = Atom.map(
  allMrsAtom,
  (result) =>
    Result.match(result, {
      onInitial: () => new Map<string, JiraIssue>(),
      onSuccess: (success) => success.value.jiraIssuesByKey,
      onFailure: () => new Map<string, JiraIssue>()
    })
);

export const openMrsTrackingAtom = appAtomRuntime.atom(
  (get) => {
    return Stream.unwrap(
      Effect.gen(function* () {
        return (yield* EventStorage.eventsStream).pipe(
          Stream.filter(isMrRelevantEvent),
          Stream.scan(
            initialOpenMrsTrackingState,
            (state: OpenMrsTrackingState, event) =>
              projectOpenMrsAndDetectMissing(state, event)
          )
        );
      })
    );
  },
  { initialValue: initialOpenMrsTrackingState }
).pipe(Atom.keepAlive);

// Filter MRs based on CacheKey criteria
const filterMrsByCacheKey = (allMrs: ReadonlyMap<string, MergeRequest>, cacheKey: CacheKey): readonly MergeRequest[] => {
  const filtered: MergeRequest[] = [];

  allMrs.forEach(mr => {
    // Filter by state
    if (mr.state !== cacheKey.state) {
      return;
    }

    // Filter by user or project
    if (cacheKey._tag === "UserMRs") {
      // Check if MR author is in the usernames list
      if (cacheKey.usernames.includes(mr.author)) {
        filtered.push(mr);
      }
    } else if (cacheKey._tag === "ProjectMRs") {
      // Check if MR belongs to the project
      if (mr.project.fullPath === cacheKey.projectPath) {
        filtered.push(mr);
      }
    }
  });

  // Sort by updated date descending
  return filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

// Filtered MRs based on current user selection and state
export const filteredMrsAtom = Atom.make((get) => {
  const selectionEntry = get(selectedUserSelectionEntryAtom);
  if (!selectionEntry) {
    return [];
  }

  const filterMrState = get(filterMrStateAtom);
  const groupsList = get(groupsAtom);
  const cacheKey = extractSelectionData(selectionEntry, groupsList, filterMrState);

  const allMrsResult = get(allMrsAtom);

  return Result.match(allMrsResult, {
    onInitial: () => [] as readonly MergeRequest[],
    onSuccess: (state) => filterMrsByCacheKey(state.value.mrsByGid, cacheKey),
    onFailure: () => [] as readonly MergeRequest[]
  });
});

// Alias for backwards compatibility
export const mergeRequestsAtom = Atom.make((get) => Result.success(get(filteredMrsAtom)));
export const unwrappedMergeRequestsAtom = filteredMrsAtom;

// Extract timestamp from global MR state
export const lastRefreshTimestampAtom = Atom.map(
  allMrsAtom,
  (result) => Result.map(result, (state: AllMrsState) => state.timestamp)
);

export const unwrappedLastRefreshTimestampAtom = Atom.map(
  lastRefreshTimestampAtom,
  (result): Date | null => {
    return Result.match(result, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (timestamp) => timestamp.value
    })
  }
);

// Derived: compute loading state
export const isMergeRequestsLoadingAtom = Atom.make((get): boolean => {
  const refreshResult = get(refreshMergeRequestsAtom);
  return Result.isWaiting(refreshResult);
});

export const refreshMergeRequestsAtom = appAtomRuntime.fn((_, get) => {
    return Effect.gen(function* () {
      const selectionEntry = get(selectedUserSelectionEntryAtom);
      if (!selectionEntry) {
        return;
      }

      const groupsList = get(groupsAtom);
      const filterMrState = get(filterMrStateAtom);
      const cacheKey = extractSelectionData(selectionEntry, groupsList, filterMrState);

      if (cacheKey._tag === "UserMRs") {
        yield* decideFetchUserMrs(cacheKey.usernames as string[], cacheKey.state)
      } else {
        yield* decideFetchProjectMrs(cacheKey.projectPath, cacheKey.state)
      }
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          yield* (yield* Console.Console).error("Error refreshing merge requests:", cause)
        })
      )
    );
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

    const selectionEntry = get(selectedUserSelectionEntryAtom);
    if (!selectionEntry) {
      yield* Console.log('[Pipeline] No selection entry found');
      return;
    }

    yield* Console.log(`[Pipeline] Refetching pipeline for MR !${selectedMr.iid}`);

    yield* refetchMrPipeline(
      selectionEntry.name,
      selectedMr.id,
      selectedMr.project.fullPath,
      selectedMr.iid,
      'opened'
    );

    yield* Console.log(`[Pipeline] Pipeline refetch complete for MR !${selectedMr.iid} (cache updates now handled by atoms)`);
  })
);

export const dumpAllMrsToFileAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const allMrsResult = get(allMrsAtom);

    const allMrsState = Result.match(allMrsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (state) => state.value
    });

    if (!allMrsState) {
      yield* Console.log('[Debug] No allMrs state available');
      return;
    }

    const debugData = {
      timestamp: allMrsState.timestamp.toISOString(),
      totalMRs: allMrsState.mrsByGid.size,
      mrsByGid: Array.from(allMrsState.mrsByGid.entries()).map(([gid, mr]) => ({
        gid,
        mr: {
          id: mr.id,
          iid: mr.iid,
          title: mr.title,
          state: mr.state,
          author: mr.author,
          projectFullPath: mr.project.fullPath,
          sourcebranch: mr.sourcebranch,
          targetbranch: mr.targetbranch,
          createdAt: mr.createdAt.toISOString(),
          updatedAt: mr.updatedAt.toISOString(),
          webUrl: mr.webUrl,
          resolvableDiscussions: mr.resolvableDiscussions,
          resolvedDiscussions: mr.resolvedDiscussions,
          unresolvedDiscussions: mr.unresolvedDiscussions,
          totalDiscussions: mr.totalDiscussions,
          approvedBy: mr.approvedBy.map(a => a.username),
          jiraIssues: mr.jiraIssueKeys
        }
      }))
    };

    yield* Effect.sync(() => {
      const filename = join('debug', `allMrs-dump-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      writeFileSync(filename, JSON.stringify(debugData, null, 2), 'utf8');
      return filename;
    }).pipe(
      Effect.tap(filename => Console.log(`[Debug] Dumped allMrs state to ${filename}`))
    );
  })
);
