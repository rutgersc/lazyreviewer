import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import UserSelectionPane from "./components/UserSelectionPane";
import MergeRequestPane from "./components/MergeRequestPane";
import InfoPane from "./components/InfoPane";
import ConsolePane from "./components/ConsolePane";
import MrStateFilterModal from "./components/MrStateFilterModal";
import GitSwitchModal from "./components/GitSwitchModal";
import HelpModal, { type HelpModalActions } from "./components/HelpModal";
import JiraModal from "./components/JiraModal";
import EventLogPane from "./components/EventLogPane";
import { ActivePane } from "./types/userSelection";
import { useAppStore } from "./store/appStore";
import { useEffect, useMemo } from 'react';
import { startJobMonitoring, stopJobMonitoring } from "./services/jobMonitor";
import { type MergeRequestState } from "./generated/gitlab-sdk";
import { openSettingsFile } from "./utils/settings";
import { useRepositoryBranches } from "./hooks/useRepositoryBranches";
import { useState } from 'react';
import { copyToClipboard } from "./utils/clipboard";
import { openUrl } from "./utils/url";

export default function App() {
  const renderer = useRenderer();
  const { activePane, infoPaneTab, setActivePane, loadMrs, scrollInfoPane, cycleInfoPaneTab } = useAppStore();
  const showFilterModal = useAppStore(state => state.showMrFilterModal);
  const setShowFilterModal = useAppStore(state => state.setShowMrFilterModal);
  const showGitSwitchModal = useAppStore(state => state.showGitSwitchModal);
  const setShowGitSwitchModal = useAppStore(state => state.setShowGitSwitchModal);
  const mrState = useAppStore(state => state.mrState);
  const setMrState = useAppStore(state => state.setMrState);
  const fetchMrs = useAppStore(state => state.fetchMrs);
  const mergeRequests = useAppStore(state => state.mergeRequests);
  const selectedIndex = useAppStore(state => state.selectedMergeRequest);
  const showHelpModal = useAppStore(state => state.showHelpModal);
  const setShowHelpModal = useAppStore(state => state.setShowHelpModal);
  const showJiraModal = useAppStore(state => state.showJiraModal);
  const setShowJiraModal = useAppStore(state => state.setShowJiraModal);
  const showEventLogPane = useAppStore(state => state.showEventLogPane);
  const setShowEventLogPane = useAppStore(state => state.setShowEventLogPane);

  const repositoryBranches = useRepositoryBranches(mergeRequests);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const toggleIgnoreMergeRequest = useAppStore(state => state.toggleIgnoreMergeRequest);
  const setSelectedUserSelectionEntry = useAppStore(state => state.setSelectedUserSelectionEntry);
  const selectedUserSelectionEntry = useAppStore(state => state.selectedUserSelectionEntry);

  // Build help modal actions
  const helpModalActions = useMemo<HelpModalActions>(() => ({
    // Global actions
    onRefresh: () => {
      setShowHelpModal(false);
      fetchMrs();
    },
    onOpenSettings: () => {
      setShowHelpModal(false);
      openSettingsFile();
    },
    onToggleConsole: () => {
      setShowHelpModal(false);
      renderer.console.toggle();
    },
    onOpenEventLog: () => {
      setShowHelpModal(false);
      if (mergeRequests.length > 0) {
        setShowEventLogPane(true);
      }
    },
    onCycleInfoTab: () => {
      setShowHelpModal(false);
      cycleInfoPaneTab('next');
    },
    onScrollInfoPaneDown: () => {
      setShowHelpModal(false);
      if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
        scrollInfoPane('down');
      }
    },
    onScrollInfoPaneUp: () => {
      setShowHelpModal(false);
      if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
        scrollInfoPane('up');
      }
    },
    onCyclePaneRight: () => {
      setShowHelpModal(false);
      if (activePane === ActivePane.MergeRequests) {
        setActivePane(ActivePane.InfoPane);
      } else if (activePane === ActivePane.InfoPane) {
        setActivePane(ActivePane.UserSelection);
      } else {
        setActivePane(ActivePane.MergeRequests);
      }
    },
    onCyclePaneLeft: () => {
      setShowHelpModal(false);
      if (activePane === ActivePane.UserSelection) {
        setActivePane(ActivePane.InfoPane);
      } else if (activePane === ActivePane.InfoPane) {
        setActivePane(ActivePane.MergeRequests);
      } else {
        setActivePane(ActivePane.UserSelection);
      }
    },

    // MR Pane actions
    onFocusInfoPane: () => {
      setShowHelpModal(false);
      setActivePane(ActivePane.InfoPane);
    },
    onFilterMRs: () => {
      setShowHelpModal(false);
      setShowFilterModal(true);
    },
    onCopyBranch: () => {
      setShowHelpModal(false);
      if (mergeRequests[selectedIndex]) {
        const sourceBranch = mergeRequests[selectedIndex].sourcebranch;
        copyToClipboard(sourceBranch).then((success) => {
          if (success) {
            setCopyNotification(`Copied: ${sourceBranch}`);
            setTimeout(() => setCopyNotification(null), 2000);
          }
        });
      }
    },
    onOpenInBrowser: () => {
      setShowHelpModal(false);
      if (mergeRequests[selectedIndex]) {
        openUrl(mergeRequests[selectedIndex].webUrl);
      }
    },
    onGitSwitch: () => {
      setShowHelpModal(false);
      setShowGitSwitchModal(true);
    },
    onShowJiraTickets: () => {
      setShowHelpModal(false);
      setShowJiraModal(true);
    },
    onToggleIgnore: () => {
      setShowHelpModal(false);
      if (mergeRequests[selectedIndex]) {
        toggleIgnoreMergeRequest(mergeRequests[selectedIndex].id);
      }
    },

    // User Selection Pane actions
    onSelectEntry: () => {
      setShowHelpModal(false);
      loadMrs();
    },
    onResetHighlight: () => {
      setShowHelpModal(false);
      // This would need to be implemented via store if needed
    },
  }), [
    fetchMrs, setShowHelpModal, renderer, mergeRequests, setShowEventLogPane,
    cycleInfoPaneTab, activePane, scrollInfoPane, setActivePane, setShowFilterModal,
    selectedIndex, setCopyNotification, setShowGitSwitchModal, setShowJiraModal,
    toggleIgnoreMergeRequest, loadMrs
  ]);

  useEffect(() => {
    // On app start, load MRs using the persisted selection entry
    loadMrs();

    // Start job monitoring service
    const monitoringInterval = startJobMonitoring();

    // Setup global error handlers to show console on fatal errors
    const errorHandler = (error: Error) => {
      renderer.console.show();
    };
    process.on('uncaughtException', errorHandler);
    process.on('unhandledRejection', errorHandler);

    // Cleanup on app exit
    return () => {
      stopJobMonitoring(monitoringInterval);
      process.off('uncaughtException', errorHandler);
      process.off('unhandledRejection', errorHandler);
    };
  }, []);

  const handleStateSelect = async (newState: MergeRequestState) => {
    if (newState !== mrState) {
      setMrState(newState);
      // Automatically refresh data when state changes
      await fetchMrs();
    }
  };

  useKeyboard((key: ParsedKey) => {
    // Handle escape - priority order: event log, modals, then pane-level
    if (key.name === 'escape') {
      if (showEventLogPane) {
        setShowEventLogPane(false);
        return;
      }
      if (showHelpModal) {
        setShowHelpModal(false);
        return;
      }
      if (showJiraModal) {
        setShowJiraModal(false);
        return;
      }
      if (showFilterModal) {
        setShowFilterModal(false);
        return;
      }
      if (showGitSwitchModal) {
        setShowGitSwitchModal(false);
        return;
      }
      // If no modals open, let pane-level handlers process escape
      return;
    }

    // Don't handle other keys when event log is open
    if (showEventLogPane) {
      return;
    }

    switch (key.name) {
      case 'q':
      case 'ctrl+c':
        process.exit();

      case '~':
        renderer.console.toggle();
        break;
      case 'o':
        if (mergeRequests.length > 0) {
          setShowEventLogPane(true);
        }
        break;
      case 's':
        if (key.ctrl) {
          openSettingsFile();
        } else {
          // Global refresh
          fetchMrs();
        }
        break;
      case '?':
        setShowHelpModal(true);
        break;
      case '[':
        cycleInfoPaneTab('prev');
        break;
      case ']':
        cycleInfoPaneTab('next');
        break;
      case 'tab':
      case 'd':
        if (key.ctrl && key.name === 'd') {
          // Ctrl+D for scrolling (works when MR or Info pane is active)
          if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
            scrollInfoPane('down');
          }
        } else if (key.name === 'tab' || key.name === 'd') {
          // Tab or d for cycling tabs
          cycleInfoPaneTab('next');
        }
        break;
      case 'u':
        if (key.ctrl) {
          // Ctrl+U for scrolling (works when MR or Info pane is active)
          if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
            scrollInfoPane('up');
          }
        }
        break;
      case 'h':
      case 'left':
        if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.InfoPane);
        } else if (activePane === ActivePane.InfoPane) {
          setActivePane(ActivePane.MergeRequests);
        } else {
          setActivePane(ActivePane.UserSelection);
        }
        break;
      case 'l':
      case 'right':
        if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.InfoPane);
        } else if (activePane === ActivePane.InfoPane) {
          setActivePane(ActivePane.UserSelection);
        } else {
          setActivePane(ActivePane.MergeRequests);
        }
        break;
    }
  });

  return (
    <box style={{ flexDirection: "column", height: "100%", backgroundColor: '#282a36' }}>
      {/* Header */}
      {/* <box style={{ padding: 0, border: true, borderColor: "#6272a4", backgroundColor: '#44475a' }}>
        <text style={{ fg: '#f8f8f2' }}>
          🚀 LazyGitLab - Merge Requests
        </text>
      </box> */}

      {/* Main content area - horizontal layout */}
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        {/* Left panel - two stacked panes */}
        <box style={{ flexDirection: "column", width: activePane === ActivePane.InfoPane ? "40%" : "55%" }}>
          {/* Merge Request Pane (top) */}
          <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.MergeRequests ? "#50fa7b" : "#6272a4",
              height: activePane === ActivePane.InfoPane ? "85%" : "80%",
              minHeight: activePane === ActivePane.InfoPane ? "85%" : "80%",
              maxHeight: activePane === ActivePane.InfoPane ? "85%" : "80%",
              backgroundColor: '#282a36'
            }}
          >
            <MergeRequestPane />
          </box>

          {/* User Selection Pane (bottom) */}
          <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.UserSelection ? "#50fa7b" : "#6272a4",
              height: activePane === ActivePane.InfoPane ? "15%" : "20%",
              minHeight: activePane === ActivePane.InfoPane ? "15%" : "20%",
              maxHeight: activePane === ActivePane.InfoPane ? "15%" : "20%",
              backgroundColor: '#282a36'
            }}
          >
            <UserSelectionPane />
          </box>
        </box>

        {/* Right panel - Info pane and footer */}
        <box
          style={{
            flexDirection: "column",
            width: activePane === ActivePane.InfoPane ? "60%" : "45%",
            backgroundColor: '#282a36'
          }}
        >
          {/* Info pane */}
          <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.InfoPane ? "#50fa7b" : "#6272a4",
              height: "70%",
              minHeight: "70%",
              maxHeight: "70%",
              backgroundColor: '#282a36'
            }}
          >
            <InfoPane />
          </box>

          {/* Console Pane */}
          <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.Console ? "#50fa7b" : "#6272a4",
              height: "30%",
              minHeight: "30%",
              maxHeight: "30%",
              backgroundColor: '#282a36'
            }}
          >
            <ConsolePane isActive={activePane === ActivePane.Console} />
          </box>
        </box>
      </box>

      {/* MR State Filter Modal - rendered at app level to cover entire screen */}
      <MrStateFilterModal
        isVisible={showFilterModal}
        currentState={mrState}
        onStateSelect={handleStateSelect}
        onClose={() => setShowFilterModal(false)}
      />

      {/* Git Switch Modal - rendered at app level to cover entire screen */}
      <GitSwitchModal
        isVisible={showGitSwitchModal}
        branchName={mergeRequests[selectedIndex]?.sourcebranch || ""}
        repoPath={repositoryBranches.find(r => r.projectPath === mergeRequests[selectedIndex]?.project.path)?.localPath || null}
        onClose={() => setShowGitSwitchModal(false)}
        onSuccess={() => {
          setCopyNotification('Branch switched!');
          setTimeout(() => setCopyNotification(null), 2000);
          fetchMrs();
        }}
      />

      {/* Help Modal - rendered at app level to cover entire screen */}
      <HelpModal isVisible={showHelpModal} activePane={activePane} infoPaneTab={infoPaneTab} actions={helpModalActions} />

      {/* Jira Modal - rendered at app level to cover entire screen */}
      <JiraModal
        isVisible={showJiraModal}
        jiraIssues={mergeRequests[selectedIndex]?.jiraIssues || []}
        onClose={() => setShowJiraModal(false)}
      />

      {/* Event Log Pane - fullscreen overlay */}
      {showEventLogPane && (
        <EventLogPane
          mergeRequests={mergeRequests}
          onClose={() => setShowEventLogPane(false)}
        />
      )}

      {/* Copy Notification - from help modal actions */}
      {copyNotification && (
        <box
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            padding: 1,
            border: true,
            borderColor: '#50fa7b',
            backgroundColor: '#282a36',
            zIndex: 1000,
          }}
        >
          <text
            style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }}
            wrap={false}
          >
            {copyNotification}
          </text>
        </box>
      )}
    </box>
  );
}