import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../mergerequests/mergerequest-schema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { ActivePane, extractSelectionData } from "../userselection/userSelection";
import { groups, mockUserSelections, users } from "../data/usersAndGroups";
import { type CacheKey, type MrRelevantEvent, AllMrsState, projectAllMrs, decideFetchUserMrs, decideFetchProjectMrs } from "../mergerequests/mergerequests-caching-effects";
import { EventStorage, type Event } from "../events/events";
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { Effect, Console, Stream, Chunk } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { loadSettings, saveSettings } from "../settings/settings";
import type { BranchDifference } from "../mergerequests/hooks/useRepositoryBranches";
import { refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { LogStorage, type LogEntry } from "../logging/logStorage";
import { loadJobLog } from '../mergerequests/pipelinejob-log-effects';
import { fetchJobHistory, type PipelineJob } from '../gitlab/gitlab-graphql';
import { writeFileSync } from 'fs';
import { join } from 'path';

export type InfoPaneTab = 'overview' | 'jira' | 'pipeline' | 'activity';

export type ActiveModal =
  | 'none'
  | 'mrFilter'
  | 'gitSwitch'
  | 'help'
  | 'jira'
  | 'retarget'
  | 'jobHistory'
  | 'eventLog';

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

export const userSelectionsAtom = Atom.make<UserSelectionEntry[]>(mockUserSelections);
export const selectedUserSelectionEntryAtom = Atom.make<number>(0);

// Phase 3: Static/Simple Data
export const groupsAtom = Atom.make(groups);
export const usersAtom = Atom.make(users);
export const currentUserAtom = Atom.make<string>('r.schoorstra');

// Phase 4: Persisted Sets with Settings Integration
export const ignoredMergeRequestsAtom = appAtomRuntime.atom(
  Effect.sync(() => new Set<string>(loadSettings().ignoredMergeRequests))
);

export const seenMergeRequestsAtom = appAtomRuntime.atom(
  Effect.sync(() => new Set<string>(loadSettings().seenMergeRequests))
);

// Phase 5: Branch Differences
export const branchDifferencesAtom = Atom.make<Map<string, BranchDifference>>(new Map());

// Phase 6: Job History
export const jobHistoryDataAtom = Atom.make<any[]>([]);
export const jobHistoryLoadingAtom = Atom.make<boolean>(false);
export const selectedJobForHistoryAtom = Atom.make<string | null>(null);
export const jobHistoryLimitAtom = Atom.make<number>(15);

// Phase 7: Pipeline Refetch
export const refetchSelectedMrPipelineAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const mergeRequests = yield* Result.toExit(get(mergeRequestsAtom));
    const selectedMrIndex = get(selectedMrIndexAtom);
    const userSelections = get(userSelectionsAtom);
    const selectedUserSelectionEntry = get(selectedUserSelectionEntryAtom);

    const selectedMr = mergeRequests[selectedMrIndex];
    if (!selectedMr) {
      yield* Console.log('[Pipeline] No MR selected');
      return;
    }

    const selectionEntry = userSelections[selectedUserSelectionEntry];
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

// Phase 8: Git State
export const lastTargetBranchAtom = Atom.make<string | null>(null);

export const toggleIgnoreMergeRequestAtom = appAtomRuntime.fn((mrId: string, get) =>
  Effect.gen(function* () {
    const currentIgnoredResult = get(ignoredMergeRequestsAtom);
    const currentIgnored = Result.match(currentIgnoredResult, {
      onInitial: () => new Set<string>(),
      onSuccess: (success) => success.value,
      onFailure: () => new Set<string>()
    });

    const newIgnored = new Set(currentIgnored);

    if (newIgnored.has(mrId)) {
      newIgnored.delete(mrId);
    } else {
      newIgnored.add(mrId);
    }

    yield* Effect.sync(() => {
      const settings = loadSettings();
      settings.ignoredMergeRequests = Array.from(newIgnored);
      saveSettings(settings);
    });
  })
);

export const toggleSeenMergeRequestAtom = appAtomRuntime.fn((mrId: string, get) =>
  Effect.gen(function* () {
    const currentSeenResult = get(seenMergeRequestsAtom);
    const currentSeen = Result.match(currentSeenResult, {
      onInitial: () => new Set<string>(),
      onSuccess: (success) => success.value,
      onFailure: () => new Set<string>()
    });

    const newSeen = new Set(currentSeen);

    if (newSeen.has(mrId)) {
      newSeen.delete(mrId);
    } else {
      newSeen.add(mrId);
    }

    yield* Effect.sync(() => {
      const settings = loadSettings();
      settings.seenMergeRequests = Array.from(newSeen);
      saveSettings(settings);
    });
  })
);

export const filterMrStateAtom = Atom.make<MergeRequestState>('opened');

// Phase 1: UI Navigation State
export const activePaneAtom = Atom.make<ActivePane>(ActivePane.MergeRequests);
export const activeModalAtom = Atom.make<ActiveModal>('none');
export const infoPaneTabAtom = Atom.make<InfoPaneTab>('overview');

const INFO_PANE_TABS: InfoPaneTab[] = ['overview', 'jira', 'pipeline', 'activity'];

export const cycleInfoPaneTabAtom = Atom.writable(
  (get) => get(infoPaneTabAtom),
  (ctx, direction: 'next' | 'prev') => {
    const currentTab = ctx.get(infoPaneTabAtom);
    const currentIndex = INFO_PANE_TABS.indexOf(currentTab);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % INFO_PANE_TABS.length
      : (currentIndex - 1 + INFO_PANE_TABS.length) % INFO_PANE_TABS.length;
    const newTab = INFO_PANE_TABS[newIndex] ?? 'overview';
    ctx.set(infoPaneTabAtom, newTab);
  }
);

// Phase 2: Selection Index State
export const selectedJiraIndexAtom = Atom.make<number>(0);
export const selectedJiraSubIndexAtom = Atom.make<number>(0);
export const selectedDiscussionIndexAtom = Atom.make<number>(0);
export const selectedActivityIndexAtom = Atom.make<number>(0);
export const selectedPipelineJobIndexAtom = Atom.make<number>(0);

export const allMrsAtom = appAtomRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const stream = yield* EventStorage.eventsStream;

      // Filter to only MR-relevant events
      const isMrRelevantEvent = (event: Event): event is MrRelevantEvent => {
        return event.type === 'gitlab-user-mrs-fetched-event' ||
               event.type === 'gitlab-project-mrs-fetched-event' ||
               event.type === 'jira-issues-fetched-event';
      };

      return stream.pipe(
        Stream.filter(isMrRelevantEvent),
        Stream.groupedWithin(100, "0.1 seconds"),
        Stream.scan(
          new AllMrsState({ mrsByGid: new Map(), timestamp: new Date() }),
          (state: AllMrsState, events) =>
            Chunk.reduce(events, state, (currentState, event) => projectAllMrs(currentState, event))
        )
      );
    })
  ),
  { initialValue: new AllMrsState({ mrsByGid: new Map(), timestamp: new Date() }) }
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
  const selectionEntry = get(userSelectionsAtom)[get(selectedUserSelectionEntryAtom)];
  if (!selectionEntry) {
    return [];
  }

  const filterMrState = get(filterMrStateAtom);
  const groupsList = get(groupsAtom);
  const cacheKey = extractSelectionData(selectionEntry, groupsList, filterMrState);

  const allMrsResult = get(allMrsAtom);

  return Result.match(allMrsResult, {
    onInitial: () => [] as readonly MergeRequest[],
    onFailure: () => [] as readonly MergeRequest[],
    onSuccess: (state) => filterMrsByCacheKey(state.value.mrsByGid, cacheKey)
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
      const selectionEntry = get(userSelectionsAtom)[get(selectedUserSelectionEntryAtom)];
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

// Phase 9: Console Logs
export const consoleLogsAtom = appAtomRuntime.subscriptionRef(
  Effect.map(LogStorage, service => service.logsRef)
)

// Event subscription - subscribes to event stream from EventStorage
export const allEventsAtom = appAtomRuntime.pull(
  Stream.unwrap(Effect.map(EventStorage, service => service.eventsStream)),
  { initialValue: [] }
)

// Re-export LogEntry type for consumers
export type { LogEntry }

// Phase 10: Job Log Loading
export const loadJobLogAtom = appAtomRuntime.fn((args: {
  mergeRequest: MergeRequest,
  job: PipelineJob }) =>
  loadJobLog(args.mergeRequest, args.job)
);

// Phase 11: Job History Loading
export const fetchJobHistoryAtom = appAtomRuntime.fn((_, get) =>
  Effect.gen(function* () {
    const selectedMr = get(selectedMrAtom);
    const selectedPipelineJobIndex = get(selectedPipelineJobIndexAtom);
    const limit = get(jobHistoryLimitAtom);

    if (!selectedMr) {
      yield* Console.log('[JobHistory] No MR selected');
      return { job: null, history: [] };
    }

    const jobs = selectedMr.pipeline.stage.flatMap((stage: any) => stage.jobs);
    const selectedJob = jobs[selectedPipelineJobIndex];

    if (!selectedJob) {
      yield* Console.log('[JobHistory] No job selected');
      return { job: null, history: [] };
    }

    yield* Console.log(`[JobHistory] Fetching history for ${selectedJob.name} (limit: ${limit})`);

    const history = yield* fetchJobHistory(
      selectedMr.project.fullPath,
      selectedJob.name,
      limit
    );

    yield* Console.log(`[JobHistory] Fetched ${history.length} entries`);

    return { job: selectedJob, history };
  })
);

// Phase 12: Increment Job History Limit
export const incrementJobHistoryLimitAtom = Atom.writable(
  (get) => get(jobHistoryLimitAtom),
  (ctx, _?: void) => {
    const currentLimit = ctx.get(jobHistoryLimitAtom);
    const newLimit = currentLimit + 15;
    ctx.set(jobHistoryLimitAtom, newLimit);
    return newLimit;
  }
);

// Phase 13: Debug Actions
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
          jiraIssues: mr.jiraIssues?.map(issue => issue.key) ?? []
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
