// This file now serves as a re-export barrel for backwards compatibility
// Atoms have been split into feature-specific files

// MR-related atoms
export {
  selectedMrIndexAtom,
  selectedMrAtom,
  branchDifferencesAtom,
  filterMrStateAtom,
  selectedDiscussionIndexAtom,
  allMrsAtom,
  allJiraIssuesAtom,
  openMrsTrackingAtom,
  filteredMrsAtom,
  mergeRequestsAtom,
  unwrappedMergeRequestsAtom,
  lastRefreshTimestampAtom,
  unwrappedLastRefreshTimestampAtom,
  isMergeRequestsLoadingAtom,
  refreshMergeRequestsAtom,
  refetchSelectedMrPipelineAtom,
  dumpAllMrsToFileAtom
} from "../mergerequests/mergerequests-atom";

// Job/Pipeline atoms
export {
  jobHistoryDataAtom,
  jobHistoryLoadingAtom,
  selectedJobForHistoryAtom,
  jobHistoryLimitAtom,
  selectedPipelineJobIndexAtom,
  loadJobLogAtom,
  fetchJobHistoryAtom,
  incrementJobHistoryLimitAtom
} from "../mergerequests/job-atom";

// Jira atoms
export {
  selectedJiraIndexAtom,
  selectedJiraSubIndexAtom
} from "../jira/jira-atom";

// Activity atoms
export {
  selectedActivityIndexAtom
} from "../components/activity-atom";

// UI Navigation atoms
export {
  type InfoPaneTab,
  type ActiveModal,
  activePaneAtom,
  activeModalAtom,
  infoPaneTabAtom,
  cycleInfoPaneTabAtom
} from "../ui/navigation-atom";

// User selection atoms
export {
  userSelectionsAtom
} from "../userselection/userselection-atom";

// Settings atoms (re-exported from settings)
export { selectedUserSelectionEntryAtom } from "../userselection/userselection-atom";

// Data atoms
export {
  groupsAtom,
  usersAtom,
  currentUserAtom
} from "../data/data-atom";

// Git atoms
export {
  lastTargetBranchAtom
} from "../git/git-atom";

// Logging atoms
export {
  consoleLogsAtom,
  type LogEntry
} from "../logging/logging-atom";

// Events atoms
export {
  allEventsAtom
} from "../events/events-atom";
