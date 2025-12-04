import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey, type RenderableOptions } from '@opentui/core';
import UserSelectionPane from "./components/UserSelectionPane";
import MergeRequestPane from "./components/MergeRequestPane";
import InfoPane from "./components/InfoPane";
import ConsolePane from "./components/ConsolePane";
import FactsPane from "./components/FactsPane";
import MrStateFilterModal from "./components/MrStateFilterModal";
import GitSwitchModal from "./components/GitSwitchModal";
import HelpModal from "./components/HelpModal";
import JiraModal from "./components/JiraModal";
import RetargetModal from "./components/RetargetModal";
import JobHistoryModal from "./components/JobHistoryModal";
import EventLogPane from "./components/EventLogPane";
import { ActivePane } from "./userselection/userSelection";
import { useEffect, useState } from 'react';
import { type MergeRequestState } from "./graphql/generated/gitlab-base-types";
import { useRepositoryBranches } from "./mergerequests/hooks/useRepositoryBranches";
import { getScroller } from "./hooks/useScrollBox";
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { filterMrStateAtom, refreshMergeRequestsAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, dumpAllMrsToFileAtom, allJiraIssuesAtom } from './mergerequests/mergerequests-atom';
import { toggleNotificationsAtom, notificationSettingsAtom } from './settings/settings-atom';
import { activePaneAtom, activeModalAtom, cycleInfoPaneTabAtom } from './ui/navigation-atom';
import { Console, Effect } from 'effect';
import { consoleLoggedLayer } from './appLayerRuntime';
import { backgroundFetchAtom, notificationStreamAtom } from './notifications/notification-sync-atom';
import { clearUnreadCount } from './notifications/title-indicator';

export default function App() {
  const refreshMergeRequests = useAtomSet(refreshMergeRequestsAtom, { mode: 'promiseExit' });
  const dumpAllMrs = useAtomSet(dumpAllMrsToFileAtom, { mode: 'promiseExit' });
  const toggleNotifications = useAtomSet(toggleNotificationsAtom, { mode: 'promiseExit' });
  const notificationSettings = useAtomValue(notificationSettingsAtom);

  const renderer = useRenderer();
  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const [activeModal, setActiveModal] = useAtom(activeModalAtom);
  const cycleInfoPaneTab = useAtomSet(cycleInfoPaneTabAtom);

  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const [selectedIndex] = useAtom(selectedMrIndexAtom);

  const repositoryBranches = useRepositoryBranches([...mergeRequests]);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const [filterMrState, setFilterMrState] = useAtom(filterMrStateAtom);
  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);

  const selectedMrJiraIssues = mergeRequests[selectedIndex]?.jiraIssueKeys.flatMap(key => {
    const issue = jiraIssuesMap.get(key);
    return issue ? [issue] : [];
  }) || [];

  useAtomValue(backgroundFetchAtom);
  useAtomValue(notificationStreamAtom);

  useEffect(() => {
    const onFocus = () => clearUnreadCount();
    renderer.on('focus', onFocus);
    return () => { renderer.off('focus', onFocus); };
  }, [renderer]);

  const handleStateSelect = async (newState: MergeRequestState) => {
    setFilterMrState(newState);
  };

  useKeyboard(async (key: ParsedKey) => {
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
      case 'z':
        renderer.console.toggle();
        break;
      case 'o':
        if (mergeRequests.length > 0) {
          setActiveModal('eventLog');
        }
        break;
      case 's':
        if (key.ctrl) {
          // openSettingsFile();
        } else {
          const mr = await refreshMergeRequests();
          Console.Console.pipe(
            Effect.flatMap(_ => _.log(mr)),
            Effect.provide(consoleLoggedLayer),
            Effect.runPromise
          );
        }
        break;
      case '?':
        setActiveModal('help');
        break;
      case '0':
        await dumpAllMrs();
        setCopyNotification('State dumped to debug/');
        setTimeout(() => setCopyNotification(null), 2000);
        break;
      case 'n':
        await toggleNotifications();
        setCopyNotification(notificationSettings.enabled ? 'Notifications disabled' : 'Notifications enabled');
        setTimeout(() => setCopyNotification(null), 2000);
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
          // When in InfoPane, navigate between tabs
          cycleInfoPaneTab('prev');
        } else if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.MergeRequests);
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.Facts);
        }
        break;
      case 'l':
      case 'right':
        if (activePane === ActivePane.InfoPane) {
          // When in InfoPane, navigate between tabs
          cycleInfoPaneTab('next');
        } else if (activePane === ActivePane.Facts) {
          setActivePane(ActivePane.MergeRequests);
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.UserSelection);
        }
        break;
    }
  });

  const infoActive = activePane === ActivePane.InfoPane;

  let factsWidthStr: RenderableOptions['width'] = infoActive ? 40 : 40;
  let middleWidthStr: RenderableOptions['width'] = infoActive ? "45%" : "55%";
  let rightWidthStr: RenderableOptions['width'] = infoActive ? "55%" : "45%";

  return (
    <box style={{ flexDirection: "column", height: "100%", backgroundColor: '#282a36' }}>
      {/* Main content area - horizontal layout */}
      <box style={{ flexDirection: "row", flexGrow: 1 }}>

        {/* Facts Pane */}
        <box
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.Facts ? "#50fa7b" : "#6272a4",
              width: factsWidthStr,
              backgroundColor: '#282a36'
            }}
        >
            <FactsPane />
        </box>

        {/* Middle panel - two stacked panes */}
        <box style={{ flexDirection: "column", width: middleWidthStr }}>
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
            width: rightWidthStr,
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
        currentState={filterMrState}
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
        jiraIssues={selectedMrJiraIssues}
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
          mergeRequests={[...mergeRequests]}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Notification Status Indicator */}
      <box
        style={{
          position: "absolute",
          bottom: 1,
          right: 2,
          backgroundColor: '#282a36',
          zIndex: 100,
        }}
      >
        <text
          style={{
            fg: notificationSettings.enabled ? '#50fa7b' : '#6272a4',
          }}
          wrapMode='none'
        >
          {notificationSettings.enabled ? '🔔' : '🔕'}
        </text>
      </box>

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
