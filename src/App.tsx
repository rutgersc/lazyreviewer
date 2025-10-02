import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import UserSelectionPane from "./components/UserSelectionPane";
import MergeRequestPane from "./components/MergeRequestPane";
import InfoPane from "./components/InfoPane";
import ConsolePane from "./components/ConsolePane";
import MrStateFilterModal from "./components/MrStateFilterModal";
import GitSwitchModal from "./components/GitSwitchModal";
import HelpModal from "./components/HelpModal";
import JiraModal from "./components/JiraModal";
import EventLogPane from "./components/EventLogPane";
import { ActivePane } from "./types/userSelection";
import { useAppStore } from "./store/appStore";
import { useEffect } from 'react';
import { startJobMonitoring, stopJobMonitoring } from "./services/jobMonitor";
import { type MergeRequestState } from "./generated/gitlab-sdk";
import { openSettingsFile } from "./utils/settings";
import { useRepositoryBranches } from "./hooks/useRepositoryBranches";
import { useState } from 'react';

export default function App() {
  const renderer = useRenderer();
  const { activePane, setActivePane, loadMrs, scrollInfoPane, cycleInfoPaneTab } = useAppStore();
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
    // Handle escape in event log pane
    if (showEventLogPane && key.name === 'escape') {
      setShowEventLogPane(false);
      return;
    }

    // Don't handle other keys when event log is open
    if (showEventLogPane) {
      return;
    }

    switch (key.name) {
      // case 'd':
      //   console.log("debug")
      //   break;
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
        }
        break;
      case '[':
        cycleInfoPaneTab('prev');
        break;
      case ']':
        cycleInfoPaneTab('next');
        break;
      case 'tab':
        cycleInfoPaneTab('next');
        break;
      case 'd':
        if (key.ctrl) {
          if (activePane === ActivePane.MergeRequests) {
            scrollInfoPane('down');
          }
        }
        break;
      case 'u':
        if (key.ctrl) {
          if (activePane === ActivePane.MergeRequests) {
            scrollInfoPane('up');
          }
        }
        break;
      case 'h':
      case 'left':
        if (activePane === ActivePane.Console) {
          setActivePane(ActivePane.UserSelection);
        } else if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.InfoPane);
        } else if (activePane === ActivePane.InfoPane) {
          setActivePane(ActivePane.MergeRequests);
        } else {
          setActivePane(ActivePane.Console);
        }
        break;
      case 'l':
      case 'right':
        if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.InfoPane);
        } else if (activePane === ActivePane.InfoPane) {
          setActivePane(ActivePane.UserSelection);
        } else if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.Console);
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
      <HelpModal isVisible={showHelpModal} />

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
    </box>
  );
}