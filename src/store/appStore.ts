import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest } from '../components/MergeRequestPane';
import type { UserGroup, UserOrGroupId, UserSelection, UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import type { BranchDifference } from '../hooks/useRepositoryBranches';
import { groups, mockUserSelections, users } from '../data/usersAndGroups';
import { shallow } from "zustand/shallow";
import { getCachedMergeRequests, fetchMergeRequests, fetchMergeRequestsByProject, refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { fetchBranchDifferences } from '../mergerequests/branch-difference-effects';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { type MergeRequestState } from '../generated/gitlab-sdk';
import { loadSettings, saveSettings } from '../settings/settings';

export type InfoPaneTab = 'overview' | 'jira' | 'pipeline' | 'activity';

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
  infoPaneTab: InfoPaneTab;
  selectedJiraIndex: number;
  selectedJiraSubIndex: number;
  selectedPipelineJobIndex: number;
  selectedDiscussionIndex: number;
  selectedActivityIndex: number;
  showMrFilterModal: boolean;
  showGitSwitchModal: boolean;
  showHelpModal: boolean;
  showJiraModal: boolean;
  showRetargetModal: boolean;
  showEventLogPane: boolean;
  infoPaneScrollOffset: number;
  lastTargetBranch: string | null;

  // selectedUsernames: () => string[]

  // Actions
  setActivePane: (pane: ActivePane) => void;
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
  setShowMrFilterModal: (show: boolean) => void;
  setShowGitSwitchModal: (show: boolean) => void;
  setShowHelpModal: (show: boolean) => void;
  setShowJiraModal: (show: boolean) => void;
  setShowRetargetModal: (show: boolean) => void;
  setShowEventLogPane: (show: boolean) => void;
  setInfoPaneScrollOffset: (offset: number) => void;
  scrollInfoPane: (direction: 'up' | 'down') => void;
  setLastTargetBranch: (branch: string) => void;
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

export const useAppStore = create<AppStore>()(persist((set, get) => ({
  activePane: ActivePane.MergeRequests,
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
  showMrFilterModal: false,
  showGitSwitchModal: false,
  showHelpModal: false,
  showJiraModal: false,
  showRetargetModal: false,
  showEventLogPane: false,
  infoPaneScrollOffset: 0,
  lastTargetBranch: null,
  currentUser: 'r.schoorstra',

  mergeRequests: [],
  branchDifferences: new Map(),
  ignoredMergeRequests: new Set(loadSettings().ignoredMergeRequests),
  seenMergeRequests: new Set(loadSettings().seenMergeRequests),
  selectedMergeRequest: 0,

  // Actions
  setSelectedMergeRequest: (mergeRequest) =>
    set({ selectedMergeRequest: mergeRequest }),

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

  setSelectedUserSelectionEntry: (entry) =>
    set({ selectedUserSelectionEntry: entry }),

  switchUserSelection: async (entry) => {
    // Clear state first to avoid crashes (same pattern as fetchMrs)
    set({ mergeRequests: [], branchDifferences: new Map() });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now set the new selection and load cached MRs
    set({ selectedUserSelectionEntry: entry, selectedMergeRequest: 0 });

    const state = get();
    const selectionEntry = state.userSelections[entry];
    if (selectionEntry) {
      const cachedMrs = getCachedMergeRequests(selectionEntry.name, state.mrState);
      console.log(`[UserSelection] Loaded ${cachedMrs.length} cached MRs for ${selectionEntry.name}`);
      set({ mergeRequests: cachedMrs });

      const differences = await fetchBranchDifferences(cachedMrs);
      set({ branchDifferences: differences });
    }
  },

  setActivePane: (pane) =>
    set({ activePane: pane }),

  setInfoPaneTab: (tab) =>
    set({ infoPaneTab: tab }),

  cycleInfoPaneTab: (direction) => {
    const state = get();
    const currentIndex = INFO_PANE_TABS.indexOf(state.infoPaneTab);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % INFO_PANE_TABS.length
      : (currentIndex - 1 + INFO_PANE_TABS.length) % INFO_PANE_TABS.length;
    set({ infoPaneTab: INFO_PANE_TABS[newIndex] });
  },

  setSelectedJiraIndex: (index) =>
    set({ selectedJiraIndex: index, selectedJiraSubIndex: 0 }),

  setSelectedJiraSubIndex: (index) =>
    set({ selectedJiraSubIndex: index }),

  setSelectedPipelineJobIndex: (index) =>
    set({ selectedPipelineJobIndex: index }),

  setSelectedDiscussionIndex: (index) =>
    set({ selectedDiscussionIndex: index }),

  setSelectedActivityIndex: (index) =>
    set({ selectedActivityIndex: index }),

  setMrState: (state) =>
    set({ mrState: state }),

  setShowMrFilterModal: (show) =>
    set({ showMrFilterModal: show }),

  setShowGitSwitchModal: (show) =>
    set({ showGitSwitchModal: show }),

  setShowHelpModal: (show) =>
    set({ showHelpModal: show }),

  setShowJiraModal: (show) =>
    set({ showJiraModal: show }),

  setShowRetargetModal: (show) =>
    set({ showRetargetModal: show }),

  setShowEventLogPane: (show) =>
    set({ showEventLogPane: show }),

  setLastTargetBranch: (branch) =>
    set({ lastTargetBranch: branch }),

  setInfoPaneScrollOffset: (offset) =>
    set({ infoPaneScrollOffset: Math.max(0, offset) }),

  scrollInfoPane: (direction) => {
    const state = get();
    const scrollAmount = 3; // Number of lines to scroll
    const newOffset = direction === 'down'
      ? state.infoPaneScrollOffset + scrollAmount
      : Math.max(0, state.infoPaneScrollOffset - scrollAmount);
    set({ infoPaneScrollOffset: newOffset });
  },

  setBranchDifferences: (differences) =>
    set({ branchDifferences: differences }),

  fetchMrs: async () => {
    const state = get();
    const selectionEntry = state.userSelections[state.selectedUserSelectionEntry];

    console.log(`Fetching MRs: ${selectionEntry?.name}`);

    if (!selectionEntry) return;

    const previouslySelectedMrId = state.mergeRequests[state.selectedMergeRequest]?.id;

    const { usernames, repositories } = extractSelectionData(
      state.selectedUserSelectionEntry,
      state.userSelections,
      users,
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
      const cachedMrs = getCachedMergeRequests(selectionEntry.name, state.mrState);
      console.log(`[MR] Loaded ${cachedMrs.length} cached MRs immediately`);
      set({ mergeRequests: cachedMrs });

      setTimeout(() => {
        fetchBranchDifferences(cachedMrs).then(differences => {
          set({ branchDifferences: differences });
        });
      }, 1);
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

    const updatedMrs = getCachedMergeRequests(selectionEntry.name, state.mrState);
    set({ mergeRequests: updatedMrs });

    console.log(`[Pipeline] Pipeline refetch complete for MR !${selectedMr.iid}`);
  },
}), {
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
  users: UserSelection[],
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
  return extractSelectionData(userSelectionEntry, userSelections, users, groups).usernames;
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