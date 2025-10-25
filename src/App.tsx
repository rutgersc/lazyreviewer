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
import RetargetModal from "./components/RetargetModal";
import JobHistoryModal from "./components/JobHistoryModal";
import EventLogPane from "./components/EventLogPane";
import { ActivePane } from "./userselection/userSelection";
import { useAppStore } from "./store/appStore";
import { useEffect, useState } from 'react';
import { type MergeRequestState } from "./generated/gitlab-sdk";
import { openSettingsFile } from "./settings/settings";
import { useRepositoryBranches } from "./hooks/useRepositoryBranches";
import { getScroller } from "./hooks/useScrollBox";
import { useAtom, RegistryContext } from '@effect-atom/atom-react';
import { filterMrStateAtom } from './store/appAtoms';
import { setAtomRegistry } from './store/appStore';
import { useContext } from 'react';

export default function App() {
  const registry = useContext(RegistryContext);

  // Initialize the atom registry so Zustand can update atoms
  useEffect(() => {
    setAtomRegistry(registry);
  }, [registry]);

  const renderer = useRenderer();
  const activePane = useAppStore(state => state.activePane);
  const setActivePane = useAppStore(state => state.setActivePane);
  const activeModal = useAppStore(state => state.activeModal);
  const setActiveModal = useAppStore(state => state.setActiveModal);
  const cycleInfoPaneTab = useAppStore(state => state.cycleInfoPaneTab);

  const loadMrs = useAppStore(state => state.loadMrs);

  const mrState = useAppStore(state => state.mrState);
  const setMrState = useAppStore(state => state.setMrState);
  const fetchMrs = useAppStore(state => state.fetchMrs);
  const mergeRequests = useAppStore(state => state.mergeRequests);
  const selectedIndex = useAppStore(state => state.selectedMergeRequest);

  const repositoryBranches = useRepositoryBranches(mergeRequests);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const [getFilterMrState, setFilterMrState] = useAtom(filterMrStateAtom);

  useEffect(() => {
    loadMrs();
  }, []);

  const handleStateSelect = async (newState: MergeRequestState) => {
    setFilterMrState(newState);
    setMrState(newState);
  };

  useKeyboard((key: ParsedKey) => {
    // Handle escape - close any active modal
    if (key.name === 'escape') {
      if (activeModal !== 'none') {
        setActiveModal('none');
        return;
      }
      // If no modals open, let pane-level handlers process escape
      return;
    }

    // Don't handle other keys when a modal is open
    if (activeModal !== 'none') {
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
          setActiveModal('eventLog');
        }
        break;
      case 's':
        if (key.ctrl) {
          openSettingsFile();
        } else {
          fetchMrs();
        }
        break;
      case '?':
        setActiveModal('help');
        break;
      case '[':
        cycleInfoPaneTab('prev');
        break;
      case ']':
        cycleInfoPaneTab('next');
        break;
      case 'tab':
      case 'd':
      case ';':
        if (key.ctrl && key.name === 'd') {
          // Ctrl+D for scrolling (works when MR or Info pane is active)
          if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
            getScroller('infoPane')?.('down');
          }
        } else if (key.name === 'tab' || key.name === 'd' || key.name === ';') {
          // Tab or ; for cycling tabs
          cycleInfoPaneTab('next');
        }
        break;
      case 'u':
        if (key.ctrl) {
          // Ctrl+U for scrolling (works when MR or Info pane is active)
          if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
            getScroller('infoPane')?.('up');
          }
        }
        break;
      case 'h':
      case 'left':
        if (activePane === ActivePane.InfoPane) {
          cycleInfoPaneTab('prev');
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.UserSelection);
        } else {
          setActivePane(ActivePane.MergeRequests);
        }
        break;
      case 'l':
      case 'right':
        if (activePane === ActivePane.InfoPane) {
          cycleInfoPaneTab('next');
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.UserSelection);
        } else {
          setActivePane(ActivePane.MergeRequests);
        }
        break;
    }
  });

  return (
    <box style={{ flexDirection: "column", height: "100%", backgroundColor: '#282a36' }}>
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
              height: "80%",
              backgroundColor: '#282a36'
            }}
          >
            <InfoPane activePane={activePane} />
          </box>

          {/* Console Pane */}
          <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.Console ? "#50fa7b" : "#6272a4",
              height: "20%",
              backgroundColor: '#282a36'
            }}
          >
            <ConsolePane isActive={activePane === ActivePane.Console} />
          </box>
        </box>
      </box>

      {/* MR State Filter Modal - rendered at app level to cover entire screen */}
      <MrStateFilterModal
        isVisible={activeModal === 'mrFilter'}
        currentState={mrState}
        onStateSelect={handleStateSelect}
        onClose={() => setActiveModal('none')}
      />

      {/* Git Switch Modal - rendered at app level to cover entire screen */}
      <GitSwitchModal
        isVisible={activeModal === 'gitSwitch'}
        branchName={mergeRequests[selectedIndex]?.sourcebranch || ""}
        repoPath={repositoryBranches.find(r => r.projectPath === mergeRequests[selectedIndex]?.project.fullPath)?.localPath || null}
        onClose={() => setActiveModal('none')}
        onSuccess={() => {
          setCopyNotification('Branch switched!');
          setTimeout(() => setCopyNotification(null), 2000);
        }}
      />

      {/* Help Modal - rendered at app level to cover entire screen */}
      <HelpModal isVisible={activeModal === 'help'} setCopyNotification={setCopyNotification} />

      {/* Jira Modal - rendered at app level to cover entire screen */}
      <JiraModal
        isVisible={activeModal === 'jira'}
        jiraIssues={mergeRequests[selectedIndex]?.jiraIssues || []}
        onClose={() => setActiveModal('none')}
      />

      {/* Retarget Modal - rendered at app level to cover entire screen */}
      <RetargetModal
        isVisible={activeModal === 'retarget'}
        onClose={() => setActiveModal('none')}
        onSuccess={() => {
          setCopyNotification('MR retargeted successfully!');
          setTimeout(() => setCopyNotification(null), 2000);
        }}
      />

      {/* Job History Modal - rendered at app level to cover entire screen */}
      <JobHistoryModal
        isVisible={activeModal === 'jobHistory'}
        onClose={() => setActiveModal('none')}
      />

      {/* Event Log Pane - fullscreen overlay */}
      {activeModal === 'eventLog' && (
        <EventLogPane
          mergeRequests={mergeRequests}
          onClose={() => setActiveModal('none')}
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
            wrapMode='none'
          >
            {copyNotification}
          </text>
        </box>
      )}
    </box>
  );
}
