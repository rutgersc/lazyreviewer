import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest } from '../components/MergeRequestPane';
import type { UserGroup, UserOrGroupId, UserSelection, UserSelectionEntry } from '../types/userSelection';
import { ActivePane } from '../types/userSelection';
import type { DetailRow } from '../components/MergeRequestDetailsPane';
import type { BranchDifference } from '../hooks/useRepositoryBranches';
import { groups, mockUserSelections, users } from '../data/usersAndGroups';
import { shallow } from "zustand/shallow";
import { getCachedMergeRequests, fetchMergeRequests, fetchMergeRequestsByProject } from '../mergerequests/mergerequests-effects';
import { fetchBranchDifferences } from '../mergerequests/branch-difference-effects';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { type MergeRequestState } from '../generated/gitlab-sdk';
import { loadSettings, saveSettings } from '../utils/settings';

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
  fetchMrs: () => Promise<void>
  loadMrs: () => Promise<void>
  setBranchDifferences: (differences: Map<string, BranchDifference>) => void
  toggleIgnoreMergeRequest: (mrId: string) => void;

  // Selection states
  selectedMergeRequest: number;
  selectedDetailItem: DetailRow | undefined;

  // UI state
  activePane: ActivePane;
  showMrFilterModal: boolean;
  showGitSwitchModal: boolean;
  showHelpModal: boolean;
  showJiraModal: boolean;
  showEventLogPane: boolean;
  infoPaneScrollOffset: number;

  // selectedUsernames: () => string[]

  // Actions
  setActivePane: (pane: ActivePane) => void;
  setSelectedUserSelectionEntry: (entry: number) => void;
  setSelectedMergeRequest: (mergeRequest: number) => void;
  setSelectedDetailItem: (item: DetailRow | undefined) => void;
  setMrState: (state: MergeRequestState) => void;
  setShowMrFilterModal: (show: boolean) => void;
  setShowGitSwitchModal: (show: boolean) => void;
  setShowHelpModal: (show: boolean) => void;
  setShowJiraModal: (show: boolean) => void;
  setShowEventLogPane: (show: boolean) => void;
  setInfoPaneScrollOffset: (offset: number) => void;
  scrollInfoPane: (direction: 'up' | 'down') => void;
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

export const useAppStore = create<AppStore>()(persist((set, get) => ({
  activePane: ActivePane.MergeRequests,

  groups: groups,
  users: users,
  userSelections: mockUserSelections,

  // Initial state (rehydrated by persist middleware)
  selectedUserSelectionEntry: 0,
  selectedDetailItem: undefined,
  mrState: 'opened',
  showMrFilterModal: false,
  showGitSwitchModal: false,
  showHelpModal: false,
  showJiraModal: false,
  showEventLogPane: false,
  infoPaneScrollOffset: 0,
  currentUser: 'r.schoorstra',

  mergeRequests: [],
  branchDifferences: new Map(),
  ignoredMergeRequests: new Set(loadSettings().ignoredMergeRequests),
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

  setSelectedUserSelectionEntry: (entry) =>
    set({ selectedUserSelectionEntry: entry }),

  setSelectedDetailItem: (item) =>
    set({ selectedDetailItem: item }),

  setActivePane: (pane) =>
    set({ activePane: pane }),

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

  setShowEventLogPane: (show) =>
    set({ showEventLogPane: show }),

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

    set({ mergeRequests: mrs });

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
        console.log("hoi", )
        fetchBranchDifferences(cachedMrs).then(differences => {
          set({ branchDifferences: differences });
        });
      }, 1000);
    }

    return;
  },
}), {
  name: 'lazygitlab-store',
  storage: fileStorage,
  partialize: (state) => ({
    selectedUserSelectionEntry: state.selectedUserSelectionEntry,
    mrState: state.mrState,
    currentUser: state.currentUser,
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