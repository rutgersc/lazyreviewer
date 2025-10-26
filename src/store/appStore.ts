import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest } from '../schemas/mergeRequestSchema';
import type { UserGroup, UserOrGroupId, UserSelection, UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import type { BranchDifference } from '../hooks/useRepositoryBranches';
import { mockUserSelections } from '../data/usersAndGroups';
import { shallow } from "zustand/shallow";
import { fetchMergeRequests, fetchMergeRequestsByProject, refetchMrPipeline } from '../mergerequests/mergerequests-effects';
import { fetchBranchDifferences } from '../mergerequests/branch-difference-effects';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { type MergeRequestState } from '../generated/gitlab-sdk';
import { loadSettings, saveSettings } from '../settings/settings';
import { fetchJobHistory, type JobHistoryEntry } from '../gitlab/gitlabgraphql';
import type * as AtomRegistry from '@effect-atom/atom/Registry';
import type { CacheKey } from '../mergerequests/mergerequests-caching-effects';
import { MRCacheKey, ProjectMRCacheKey } from '../mergerequests/mergerequests-caching-effects';

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
  userSelections: UserSelectionEntry[];
  selectedUserSelectionEntry: number;

  mergeRequests: MergeRequest[];
  fetchMrs: () => Promise<void>
  loadMrs: () => Promise<void>
  fetchJobHistoryForSelectedJob: (selectedPipelineJobIndex: number) => Promise<void>;

  // Selection states
  selectedMergeRequest: number;

  // selectedUsernames: () => string[]

  // Actions
  setSelectedUserSelectionEntry: (entry: number) => void;
  setSelectedMergeRequest: (mergeRequest: number) => void;
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

export const useAppStore = create<AppStore>()(persist((set, get) => {

  return ({
    infoPaneTab: 'overview',

    userSelections: mockUserSelections,

    // Initial state (rehydrated by persist middleware)
    selectedUserSelectionEntry: 0,

    mergeRequests: [],
    selectedMergeRequest: 0,

    // Actions
    setSelectedMergeRequest: (mergeRequest) => set({ selectedMergeRequest: mergeRequest }),

    setSelectedUserSelectionEntry: (entry) => set({ selectedUserSelectionEntry: entry }),

    fetchJobHistoryForSelectedJob: async (selectedPipelineJobIndex: number) => {
      const state = get();
      const selectedMr = state.mergeRequests[state.selectedMergeRequest];
      if (!selectedMr) {
        console.log('[JobHistory] No MR selected');
        return;
      }

      const jobs = selectedMr.pipeline.stage.flatMap(stage => stage.jobs);
      const selectedJob = jobs[selectedPipelineJobIndex];
      if (!selectedJob) {
        console.log('[JobHistory] No job selected');
        return;
      }

      try {
        const history = await fetchJobHistory(
          selectedMr.project.fullPath,
          selectedJob.name,
          15
        );
        console.log('[JobHistory] Fetched history:', history);
      } catch (error) {
        console.error('[JobHistory] Failed to fetch job history:', error);
      }
    },

    fetchMrs: async () => {
      const state = get();
      const selectionEntry = state.userSelections[state.selectedUserSelectionEntry];

      console.log(`Fetching MRs: ${selectionEntry?.name}`);

      if (!selectionEntry) return;

      const previouslySelectedMrId = state.mergeRequests[state.selectedMergeRequest]?.id;

      // const { usernames, repositories } = extractSelectionData(
      //   state.selectedUserSelectionEntry,
      //   state.userSelections,
      //   groups
      // );

      // let mrs: MergeRequest[];

      // if (repositories.length > 0 && repositories[0]) {
      //   mrs = await fetchMergeRequestsByProject(selectionEntry.name, repositories[0], state.mrState);
      // } else if (usernames.length > 0) {
      //   mrs = await fetchMergeRequests(selectionEntry.name, usernames, state.mrState);
      // } else {
      //   mrs = [];
      // }

      // set({ mergeRequests: [], branchDifferences: new Map() });
      // await new Promise(resolve => setTimeout(resolve, 100));

      // const newSelectedIndex = previouslySelectedMrId
      //   ? mrs.findIndex(mr => mr.id === previouslySelectedMrId)
      //   : -1;

      // set({
      //   mergeRequests: mrs,
      //   selectedMergeRequest: newSelectedIndex >= 0 ? newSelectedIndex : 0
      // });

      // fetchBranchDifferences(mrs).then(differences => {
      //   set({ branchDifferences: differences });
      // });
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
  });
}, {
  name: 'lazygitlab-store',
  storage: fileStorage,
  partialize: (state) => ({
    selectedUserSelectionEntry: state.selectedUserSelectionEntry,
    mrState: 'opened',
  }),
}));

export const extractSelectionData = (
  entry: UserSelectionEntry | undefined,
  groups: UserGroup[],
  state: MergeRequestState
): CacheKey | undefined => {
  if (!entry) return undefined;

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

  const repositoriesArray = Array.from(repositories);
  const usernamesArray = Array.from(usernames);

  if (repositoriesArray.length > 0 && repositoriesArray[0]) {
    return new ProjectMRCacheKey({
      projectPath: repositoriesArray[0],
      state
    });
  } else if (usernamesArray.length > 0) {
    return new MRCacheKey({
      usernames: usernamesArray,
      state
    });
  }

  return undefined;
};

