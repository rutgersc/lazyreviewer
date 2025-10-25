import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest } from '../schemas/mergeRequestSchema';
import type { UserGroup, UserOrGroupId, UserSelection, UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import type { BranchDifference } from '../hooks/useRepositoryBranches';
import { groups, mockUserSelections, users } from '../data/usersAndGroups';
import { shallow } from "zustand/shallow";
import { fetchMergeRequests, fetchMergeRequestsByProject, refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { fetchBranchDifferences } from '../mergerequests/branch-difference-effects';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { type MergeRequestState } from '../generated/gitlab-sdk';
import { loadSettings, saveSettings } from '../settings/settings';
import { fetchJobHistory, type JobHistoryEntry } from '../gitlab/gitlabgraphql';
import type * as AtomRegistry from '@effect-atom/atom/Registry';

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

interface AppStore {
  groups: UserGroup[]
  users: UserSelection[]
  userSelections: UserSelectionEntry[];
  selectedUserSelectionEntry: number;
  currentUser: string;

  // MR filtering state
  mrState: MergeRequestState;

  mergeRequests: MergeRequest[];
  branchDifferences: Map<string, BranchDifference>;
  ignoredMergeRequests: Set<string>;
  seenMergeRequests: Set<string>;
  fetchMrs: () => Promise<void>
  loadMrs: () => Promise<void>
  setBranchDifferences: (differences: Map<string, BranchDifference>) => void
  toggleIgnoreMergeRequest: (mrId: string) => void;
  toggleSeenMergeRequest: (mrId: string) => void;
  refetchSelectedMrPipeline: () => Promise<void>;

  // Selection states
  selectedMergeRequest: number;

  // UI state
  activePane: ActivePane;
  activeModal: ActiveModal;
  infoPaneTab: InfoPaneTab;
  selectedJiraIndex: number;
  selectedJiraSubIndex: number;
  selectedPipelineJobIndex: number;
  selectedDiscussionIndex: number;
  selectedActivityIndex: number;
  lastTargetBranch: string | null;
  jobHistoryData: JobHistoryEntry[];
  jobHistoryLoading: boolean;
  selectedJobForHistory: string | null;

  // selectedUsernames: () => string[]

  // Actions
  setActivePane: (pane: ActivePane) => void;
  setActiveModal: (modal: ActiveModal) => void;
  setInfoPaneTab: (tab: InfoPaneTab) => void;
  cycleInfoPaneTab: (direction: 'next' | 'prev') => void;
  setSelectedJiraIndex: (index: number) => void;
  setSelectedJiraSubIndex: (index: number) => void;
  setSelectedPipelineJobIndex: (index: number) => void;
  setSelectedDiscussionIndex: (index: number) => void;
  setSelectedActivityIndex: (index: number) => void;
  setSelectedUserSelectionEntry: (entry: number) => void;
  switchUserSelection: (entry: number) => Promise<void>;
  setSelectedMergeRequest: (mergeRequest: number) => void;
  setMrState: (state: MergeRequestState) => void;
  setLastTargetBranch: (branch: string) => void;
  fetchJobHistoryForSelectedJob: () => Promise<void>;
}

const STORE_FILE = 'debug/store.json';
const fileStorage = createJSONStorage(() => ({
  getItem: () => (existsSync(STORE_FILE) ? readFileSync(STORE_FILE, 'utf8') : null),
  setItem: (_name, value) => {
    const dir = dirname(STORE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STORE_FILE, value, 'utf8');
  },
  removeItem: () => { try { unlinkSync(STORE_FILE); } catch { /* noop */ } },
}));

const INFO_PANE_TABS: InfoPaneTab[] = ['overview', 'jira', 'pipeline', 'activity'];

// Helper to sync atom state with store changes
let atomRegistry: AtomRegistry.Registry | null = null;

export function setAtomRegistry(registry: AtomRegistry.Registry) {
  atomRegistry = registry;
}

function updateAtoms(entry?: number, mrState?: MergeRequestState) {
  if (!atomRegistry) return;

  // Import atoms dynamically to avoid circular dependency
  import('./appAtoms').then(({ selectedUserSelectionEntryAtom, filterMrStateAtom }) => {
    if (entry !== undefined) atomRegistry!.set(selectedUserSelectionEntryAtom, entry);
    if (mrState !== undefined) atomRegistry!.set(filterMrStateAtom, mrState);
  });
}

export const useAppStore = create<AppStore>()(persist((set, get) => {

  const refreshMrList = async (entry: number, mrState: MergeRequestState) => {
    // Clear state first to avoid crashes (same pattern as fetchMrs)
      set({
        mergeRequests: [],
        branchDifferences: new Map(),
        selectedMergeRequest: 0,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      set({ selectedUserSelectionEntry: entry, selectedMergeRequest: 0, mrState: mrState });

      // Update atoms to trigger reactivity
      updateAtoms(entry, mrState);

      const state = get();
      const selectionEntry = state.userSelections[entry];
      if (selectionEntry) {
        console.log(
          `[UserSelection] Loading MRs for ${selectionEntry.name} (now handled by atoms)`
        );
        set({ mergeRequests: [], mrState: mrState });
        const differences = await fetchBranchDifferences([]);
        set({ branchDifferences: differences });
      }
  };

  return ({
    activePane: ActivePane.MergeRequests,
    activeModal: 'none',
    infoPaneTab: 'overview',
    selectedJiraIndex: 0,
    selectedJiraSubIndex: 0,
    selectedPipelineJobIndex: 0,
    selectedDiscussionIndex: 0,
    selectedActivityIndex: 0,

    groups: groups,
    users: users,
    userSelections: mockUserSelections,

    // Initial state (rehydrated by persist middleware)
    selectedUserSelectionEntry: 0,
    mrState: 'opened',
    lastTargetBranch: null,
    currentUser: 'r.schoorstra',
    jobHistoryData: [],
    jobHistoryLoading: false,
    selectedJobForHistory: null,

    mergeRequests: [],
    branchDifferences: new Map(),
    ignoredMergeRequests: new Set(loadSettings().ignoredMergeRequests),
    seenMergeRequests: new Set(loadSettings().seenMergeRequests),
    selectedMergeRequest: 0,

    // Actions
    setSelectedMergeRequest: (mergeRequest) => set({ selectedMergeRequest: mergeRequest }),

    toggleIgnoreMergeRequest: (mrId) => {
      const state = get();
      const newIgnored = new Set(state.ignoredMergeRequests);

      if (newIgnored.has(mrId)) {
        newIgnored.delete(mrId);
      } else {
        newIgnored.add(mrId);
      }

      set({ ignoredMergeRequests: newIgnored });

      const settings = loadSettings();
      settings.ignoredMergeRequests = Array.from(newIgnored);
      saveSettings(settings);
    },

    toggleSeenMergeRequest: (mrId) => {
      const state = get();
      const newSeen = new Set(state.seenMergeRequests);

      if (newSeen.has(mrId)) {
        newSeen.delete(mrId);
      } else {
        newSeen.add(mrId);
      }

      set({ seenMergeRequests: newSeen });

      const settings = loadSettings();
      settings.seenMergeRequests = Array.from(newSeen);
      saveSettings(settings);
    },

    setSelectedUserSelectionEntry: (entry) => set({ selectedUserSelectionEntry: entry }),

    switchUserSelection: async (entry) => {
      await refreshMrList(entry, get().mrState);
    },
    setMrState: async (state) => {

      await refreshMrList(get().selectedUserSelectionEntry, state);
    },

    setActivePane: (pane) => set({ activePane: pane }),

    setActiveModal: (modal) => set({ activeModal: modal }),

    setInfoPaneTab: (tab) => set({ infoPaneTab: tab }),

    cycleInfoPaneTab: (direction) => {
      const state = get();
      const currentIndex = INFO_PANE_TABS.indexOf(state.infoPaneTab);
      const newIndex = direction === 'next'
        ? (currentIndex + 1) % INFO_PANE_TABS.length
        : (currentIndex - 1 + INFO_PANE_TABS.length) % INFO_PANE_TABS.length;
      set({ infoPaneTab: INFO_PANE_TABS[newIndex] });
    },

    setSelectedJiraIndex: (index) => set({ selectedJiraIndex: index, selectedJiraSubIndex: 0 }),

    setSelectedJiraSubIndex: (index) => set({ selectedJiraSubIndex: index }),

    setSelectedPipelineJobIndex: (index) => set({ selectedPipelineJobIndex: index }),

    setSelectedDiscussionIndex: (index) => set({ selectedDiscussionIndex: index }),

    setSelectedActivityIndex: (index) => set({ selectedActivityIndex: index }),

    setLastTargetBranch: (branch) => set({ lastTargetBranch: branch }),

    fetchJobHistoryForSelectedJob: async () => {
      const state = get();
      const selectedMr = state.mergeRequests[state.selectedMergeRequest];
      if (!selectedMr) {
        console.log('[JobHistory] No MR selected');
        return;
      }

      const jobs = selectedMr.pipeline.stage.flatMap(stage => stage.jobs);
      const selectedJob = jobs[state.selectedPipelineJobIndex];
      if (!selectedJob) {
        console.log('[JobHistory] No job selected');
        return;
      }

      set({ jobHistoryLoading: true, selectedJobForHistory: selectedJob.name });

      try {
        const history = await fetchJobHistory(
          selectedMr.project.fullPath,
          selectedJob.name,
          15
        );
        set({ jobHistoryData: history, jobHistoryLoading: false });
      } catch (error) {
        console.error('[JobHistory] Failed to fetch job history:', error);
        set({ jobHistoryData: [], jobHistoryLoading: false });
      }
    },

    setBranchDifferences: (differences) => set({ branchDifferences: differences }),

    fetchMrs: async () => {
      const state = get();
      const selectionEntry = state.userSelections[state.selectedUserSelectionEntry];

      console.log(`Fetching MRs: ${selectionEntry?.name}`);

      if (!selectionEntry) return;

      const previouslySelectedMrId = state.mergeRequests[state.selectedMergeRequest]?.id;

      const { usernames, repositories } = extractSelectionData(
        state.selectedUserSelectionEntry,
        state.userSelections,
        groups
      );

      let mrs: MergeRequest[];

      if (repositories.length > 0 && repositories[0]) {
        mrs = await fetchMergeRequestsByProject(selectionEntry.name, repositories[0], state.mrState);
      } else if (usernames.length > 0) {
        mrs = await fetchMergeRequests(selectionEntry.name, usernames, state.mrState);
      } else {
        mrs = [];
      }

      set({ mergeRequests: [], branchDifferences: new Map() });
      await new Promise(resolve => setTimeout(resolve, 100));

      const newSelectedIndex = previouslySelectedMrId
        ? mrs.findIndex(mr => mr.id === previouslySelectedMrId)
        : -1;

      set({
        mergeRequests: mrs,
        selectedMergeRequest: newSelectedIndex >= 0 ? newSelectedIndex : 0
      });

      fetchBranchDifferences(mrs).then(differences => {
        set({ branchDifferences: differences });
      });
    },

    loadMrs: async () => {
      const state = get();
      const selectionEntry = state.userSelections[state.selectedUserSelectionEntry];
      if (selectionEntry) {
        console.log(`[MR] MR loading now handled by atoms`);
        // set({ mergeRequests: [] });

        // setTimeout(() => {
          // fetchBranchDifferences([]).then(differences => {
          //   set({ branchDifferences: differences });
          // });
        // }, 1);
      }

      return;
    },

    refetchSelectedMrPipeline: async () => {
      const state = get();
      const selectedMr = state.mergeRequests[state.selectedMergeRequest];
      if (!selectedMr) {
        console.log('[Pipeline] No MR selected');
        return;
      }

      const selectionEntry = state.userSelections[state.selectedUserSelectionEntry];
      if (!selectionEntry) {
        console.log('[Pipeline] No selection entry found');
        return;
      }

      console.log(`[Pipeline] Refetching pipeline for MR !${selectedMr.iid}`);

      await refetchMrPipeline(
        selectionEntry.name,
        selectedMr.id,
        selectedMr.project.fullPath,
        selectedMr.iid,
        state.mrState
      );

      console.log(`[Pipeline] Pipeline refetch complete for MR !${selectedMr.iid} (cache updates now handled by atoms)`);
    },
  });
}, {
  name: 'lazygitlab-store',
  storage: fileStorage,
  partialize: (state) => ({
    selectedUserSelectionEntry: state.selectedUserSelectionEntry,
    mrState: state.mrState,
    currentUser: state.currentUser,
    lastTargetBranch: state.lastTargetBranch,
  }),
}));

export const extractSelectionData = (
  userSelectionEntry: number,
  userSelections: UserSelectionEntry[],
  groups: UserGroup[]
): { usernames: string[]; repositories: string[] } => {
  const entry = userSelections[userSelectionEntry];
  if (!entry) return { usernames: [], repositories: [] };

  const usernames = new Set<string>();
  const repositories = new Set<string>();

  const processId = (id: UserOrGroupId) => {
    if (id.type === 'userId') {
      usernames.add(id.id);
    } else if (id.type === 'groupId') {
      const group = groups.find(g => g.id.id === id.id);
      if (group) {
        group.children.forEach(processId);
      }
    } else if (id.type === 'repositoryId') {
      repositories.add(id.id);
    }
  };

  entry.selection.forEach(processId);
  return {
    usernames: Array.from(usernames),
    repositories: Array.from(repositories)
  };
};

export const extractUsernamesFromUserSelectionEntry = (
  userSelectionEntry: number,
  userSelections: UserSelectionEntry[],
  users: UserSelection[],
  groups: UserGroup[]
): string[] => {
  return extractSelectionData(userSelectionEntry, userSelections, groups).usernames;
};


// Source: https://github.com/pmndrs/zustand/issues/108#issuecomment-2197556875
export function computed<
  const TDeps extends readonly unknown[] = unknown[],
  TResult = unknown,
>(depsFn: () => TDeps, computeFn: (...deps: TDeps) => TResult): () => TResult {
  let prevDeps: TDeps;
  let cachedResult: TResult;
  return () => {
    const deps = depsFn();
    if (prevDeps === undefined || !shallow(prevDeps, deps)) {
      prevDeps = deps;
      cachedResult = computeFn(...deps);
    }
    return cachedResult;
  };
}