import { Atom, Result } from "@effect-atom/atom-react";
import type { MergeRequest } from "../schemas/mergeRequestSchema";
import type { UserSelectionEntry } from "../userselection/userSelection";
import { ActivePane, extractSelectionData } from "../userselection/userSelection";
import { groups, mockUserSelections, users } from "../data/usersAndGroups";
import { type CacheKey, forceRefreshUserMRsCache, forceRefreshProjectMRsCache, MRCacheKey, fetchUserMRsWithCache, ProjectMRCacheKey, fetchProjectMRsWithCache } from "../mergerequests/mergerequests-caching-effects";
import type { MergeRequestState } from "../generated/gitlab-sdk";
import { Effect, Console } from "effect";
import { appAtomRuntime } from "./appLayerRuntime";
import { loadSettings, saveSettings } from "../settings/settings";
import type { BranchDifference } from "../hooks/useRepositoryBranches";
import { refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { LogStorage, type LogEntry } from "../services/logStorage";
import { loadJobLog } from '../gitlab/pipelinejob-log';


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

export const mergeRequestsKeyAtom = Atom.make((get): CacheKey | undefined  => {
    const userSelections = get(userSelectionsAtom);
    const userSelectionIndex = get(selectedUserSelectionEntryAtom);
    const selectionEntry = userSelections[userSelectionIndex];
    const filterMrState = get(filterMrStateAtom);
    const groups = get(groupsAtom);

    return extractSelectionData(selectionEntry, groups, filterMrState);
})

const mrsByKeyAtomFamily = Atom.family((key: CacheKey) => {
    const oh = Effect.gen(function* () {
      return key._tag === "UserMRs"
          ? yield* fetchUserMRsWithCache(key)
          : yield* fetchProjectMRsWithCache(key);
    })
    .pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          yield* (yield* Console.Console).error("Error fetching merge requests:", cause);
          return [] as readonly MergeRequest[] ;
        })
      )
    );

    const atom = appAtomRuntime.atom(oh);
    return atom.pipe(Atom.setLazy(false), Atom.keepAlive);
});

export const mergeRequestsAtom = Atom.make((get) => {
  const cacheKey = get(mergeRequestsKeyAtom);
  if (!cacheKey) {
    console.log("mergeRequestsAtom NOOOO cacheKey", cacheKey)
    return Result.success([]);
  }
  console.log("mergeRequestsAtom")
  return get(mrsByKeyAtomFamily(cacheKey));
})

export const unwrappedMergeRequestsAtom = Atom.map(
    mergeRequestsAtom,
    (result): readonly MergeRequest[] => {
        return Result.match(result, {
            onInitial: () => [],
            onFailure: () => [],
            onSuccess: (mrs) =>  mrs.value
        })
    }
)

export const refreshMergeRequestsAtom = appAtomRuntime.fn((_, get) => {
    const f = Effect.gen(function* () {

      const cacheKey = get(mergeRequestsKeyAtom);
      if (!cacheKey) {
        return;
      }

      switch (cacheKey._tag) {
        case "ProjectMRs":
          yield* forceRefreshProjectMRsCache(cacheKey);
          break;
        case "UserMRs":
          yield* forceRefreshUserMRsCache(cacheKey);
          break;
      }

      // fetchBranchDifferences(mrs).then(differences => {
      //   set({ branchDifferences: differences });
      // });
      // Refresh the atom to read the newly updated cache
      get.refresh(mergeRequestsKeyAtom);
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          yield* (yield* Console.Console).error("Error refreshing merge requests:", cause)
        })
      )
    );

    return f;
  }
)

// Phase 9: Console Logs
export const consoleLogsAtom = appAtomRuntime.subscriptionRef(
  Effect.map(LogStorage, service => service.logsRef)
)

// Re-export LogEntry type for consumers
export type { LogEntry }

// Phase 10: Job Log Loading
export const loadJobLogAtom = appAtomRuntime.fn((args: { mergeRequest: MergeRequest, job: import("../schemas/mergeRequestSchema").PipelineJob }) =>
  loadJobLog(args.mergeRequest, args.job)
);




const fetchJobHistoryForSelectedJob = async (selectedPipelineJobIndex: number) => {
    //   const state = get();
    //   const selectedMr = state.mergeRequests[state.selectedMergeRequest];
    //   if (!selectedMr) {
    //     console.log('[JobHistory] No MR selected');
    //     return;
    //   }

    //   const jobs = selectedMr.pipeline.stage.flatMap(stage => stage.jobs);
    //   const selectedJob = jobs[selectedPipelineJobIndex];
    //   if (!selectedJob) {
    //     console.log('[JobHistory] No job selected');
    //     return;
    //   }

    //   try {
    //     const history = await fetchJobHistory(
    //       selectedMr.project.fullPath,
    //       selectedJob.name,
    //       15
    //     );
    //     console.log('[JobHistory] Fetched history:', history);
    //   } catch (error) {
    //     console.error('[JobHistory] Failed to fetch job history:', error);
    //   }

    };