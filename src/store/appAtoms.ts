import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../mergerequests/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { ActivePane, extractSelectionData } from "../userselection/userSelection";
import { groups, mockUserSelections, users } from "../data/usersAndGroups";
import { type CacheKey, MRCacheKey, ProjectMRCacheKey, ensureMRsEvents, queryMRsFromEvents, projectMrState, type MrState, MrStateNotFetched, MrStateFetched, type MrRelevantEvent } from "../mergerequests/mergerequests-caching-effects";
import { EventStorage, type Event } from "../events/events";
import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { Effect, Console, Stream, SubscriptionRef, Match, Hash, Equal, Duration, Chunk } from "effect";
import { appAtomRuntime } from "./appLayerRuntime";
import { loadSettings, saveSettings } from "../settings/settings";
import type { BranchDifference } from "../hooks/useRepositoryBranches";
import { refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { LogStorage, type LogEntry } from "../logging/logStorage";
import { loadJobLog } from '../mergerequests/pipelinejob-log-effects';
import { fetchJobHistory, type PipelineJob } from '../gitlab/gitlab-graphql';


// const STORE_FILE = 'debug/store.json';
// const fileStorage = createJSONStorage(() => ({
//   getItem: () => (existsSync(STORE_FILE) ? readFileSync(STORE_FILE, 'utf8') : null),
//   setItem: (_name, value) => {
//     const dir = dirname(STORE_FILE);
//     if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
//     writeFileSync(STORE_FILE, value, 'utf8');
//   },
//   removeItem: () => { try { unlinkSync(STORE_FILE); } catch { /* noop */ } },
// }));


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

// Simple string key for atom family - derived from user selection + filter state
export const mergeRequestsCacheKeyStringAtom = Atom.make((get): string | undefined => {
    const selectionEntry = get(userSelectionsAtom)[get(selectedUserSelectionEntryAtom)];
    if (!selectionEntry) {
      return undefined;
    }

    const filterMrState = get(filterMrStateAtom);

    // Create stable string key using userSelectionEntryId + state
    return `${selectionEntry.userSelectionEntryId}:${filterMrState}`;
})

export const log = (...args: ReadonlyArray<any>) =>
  Effect.andThen(Console.Console, _ => _.log(...args));

export const error = (...args: ReadonlyArray<any>) =>
  Effect.andThen(Console.Console, _ => _.log(...args));

const mrsCacheByKeyAtomFamily = Atom.family((keyString: string) => {
  console.log("[Atom] mrsCacheByKeyAtomFamily created for key:", keyString);

  // Parse once to get the IDs for lookup
  const [userSelectionEntryId, stateStr] = keyString.split(":");
  const state = stateStr as MergeRequestState;

  return appAtomRuntime.atom(get =>
    Stream.unwrap(
      Effect.gen(function* () {
        const userSelections = get(userSelectionsAtom);
        const selectionEntry = userSelections.find(e => e.userSelectionEntryId === userSelectionEntryId);
        if (!selectionEntry) {
          throw new Error(`UserSelectionEntry not found: ${userSelectionEntryId}`);
        }

        const groupsList = get(groupsAtom);
        const cacheKey = extractSelectionData(selectionEntry, groupsList, state);

        // Filter to only MR-relevant events
        const isMrRelevantEvent = (event: Event): event is MrRelevantEvent => {
          return event.type === 'gitlab-user-mrs-fetched-event' ||
                 event.type === 'gitlab-project-mrs-fetched-event' ||
                 event.type === 'jira-issues-fetched-event';
        };

        return Stream.groupedWithin(yield* EventStorage.eventsStream, 100, "0.1 seconds").pipe(
          Stream.map(chunk => Chunk.filter(chunk, isMrRelevantEvent)),
          Stream.scan(
            new MrStateNotFetched(),
            (mrState: MrState, events) =>
              Chunk.reduce(
                events,
                mrState,
                (currentState, event) => projectMrState(cacheKey)(currentState, event))
          )
        );
      })
    ),
    { initialValue: new MrStateNotFetched() }
  ).pipe(Atom.keepAlive); // Keep atom alive even when unmounted
});

// Core atom: exposes the full MrState discriminated union
export const mrStateAtom = Atom.make((get) => {
  const keyString = get(mergeRequestsCacheKeyStringAtom);
  if (!keyString) return Result.success(new MrStateNotFetched());

  const cacheResult = get(mrsCacheByKeyAtomFamily(keyString));

  return cacheResult; // Result<MrState, E>
})

// Derived: unwrapped MrState for direct access
export const unwrappedMrStateAtom = Atom.map(
  mrStateAtom,
  (result): MrState => {
    return Result.match(result, {
      onInitial: () => new MrStateNotFetched(),
      onFailure: () => new MrStateNotFetched(),
      onSuccess: (state) => state.value
    })
  }
)

// Derived: extract just the MR array
export const mergeRequestsAtom = Atom.map(
  mrStateAtom,
  (result) => Result.map(result, (state: MrState) =>
    Match.value(state).pipe(
      Match.tag("NotFetched", () => [] as readonly MergeRequest[]),
      Match.tag("Fetched", (s) => s.data),
      Match.exhaustive
    )
  )
)

// Derived: unwrapped MR array for convenience
export const unwrappedMergeRequestsAtom = Atom.map(
  mergeRequestsAtom,
  (result): readonly MergeRequest[] => {
    return Result.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: (mrs) => mrs.value
    })
  }
)

// Derived: extract timestamp from MrState
export const lastRefreshTimestampAtom = Atom.map(
  mrStateAtom,
  (result) => Result.map(result, (state: MrState) =>
    Match.value(state).pipe(
      Match.tag("NotFetched", () => null as Date | null),
      Match.tag("Fetched", (s) => s.timestamp),
      Match.exhaustive
    )
  )
)

export const unwrappedLastRefreshTimestampAtom = Atom.map(
  lastRefreshTimestampAtom,
  (result): Date | null => {
    return Result.match(result, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (timestamp) => timestamp.value
    })
  }
)

// Derived: compute loading state from MrState
export const isMergeRequestsLoadingAtom = Atom.make((get): boolean => {
  const stateResult = get(mrStateAtom);
  const refreshResult = get(refreshMergeRequestsAtom);

  // Note: stateResult.waiting is always true because the stream continuously listens for events
  return Result.match(stateResult, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: (state) => Match.value(state.value as MrState).pipe(
      Match.tag("NotFetched", () => Result.isWaiting(refreshResult)),
      Match.tag("Fetched", () => Result.isWaiting(refreshResult)),
      Match.exhaustive
    )
  });
});

export const refreshMergeRequestsAtom = appAtomRuntime.fn((_, get) => {
    return Effect.gen(function* () {
      const selectionEntry = get(userSelectionsAtom)[get(selectedUserSelectionEntryAtom)];
      if (!selectionEntry) {
        return;
      }

      const filterMrState = get(filterMrStateAtom);
      // Note: When groups becomes dynamic via groupsAtom, use get(groupsAtom) here
      const groupsList = get(groupsAtom);
      const cacheKey = extractSelectionData(selectionEntry, groupsList, filterMrState);
      yield* ensureMRsEvents(cacheKey);
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
