import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey, type RenderableOptions } from '@opentui/core';
import UserSelectionPane from "./components/UserSelectionPane";
import MergeRequestPane from "./components/MergeRequestPane";
import InfoPane from "./components/InfoPane";
import ConsolePane from "./components/ConsolePane";
import FactsPane from "./components/FactsPane";
import MrSortModal from "./components/MrSortModal";
import GitSwitchModal from "./components/GitSwitchModal";
import HelpModal from "./components/HelpModal";
import JiraModal from "./components/JiraModal";
import RetargetModal from "./components/RetargetModal";
import JobHistoryModal from "./components/JobHistoryModal";
import EventLogPane from "./components/EventLogPane";
import { JiraBoardPage } from "./jiraboard";
import MonitoredMergeRequestsPage from "./components/MonitoredMergeRequestsPage";
import { ActivePane } from "./userselection/userSelection";
import { useEffect, useMemo, useState } from 'react';
import type { Action } from './actions/action-types';
import { parseKeyString, matchesAnyKey } from './actions/key-matcher';
import { activePaneActionsAtom } from './actions/pane-actions-atoms';
import { type MergeRequestState } from "./graphql/generated/gitlab-base-types";
import { useRepositoryBranches } from "./mergerequests/hooks/useRepositoryBranches";
import { getScroller } from "./hooks/useScrollBox";
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { filterMrStateAtom, refreshMergeRequestsAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, dumpAllMrsToFileAtom, allJiraIssuesAtom, mrSortOrderAtom, type MrSortOrder } from './mergerequests/mergerequests-atom';
import { toggleNotificationsAtom, notificationSettingsAtom, jiraBoardIdAtom } from './settings/settings-atom';
import { activePaneAtom, activeModalAtom, cycleInfoPaneTabAtom } from './ui/navigation-atom';
import { jiraBoardFocusKeyAtom } from './jiraboard/atoms';
import { Console, Effect } from 'effect';
import { appInitAtom } from './app-init';
import { clearUnreadCount } from './notifications/title-indicator';

export default function App() {
  useAtomValue(appInitAtom);

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
  const [sortOrder, setSortOrder] = useAtom(mrSortOrderAtom);
  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);
  const jiraBoardId = useAtomValue(jiraBoardIdAtom);
  const setJiraBoardFocusKey = useAtomSet(jiraBoardFocusKeyAtom);

  const selectedMrJiraIssues = mergeRequests[selectedIndex]?.jiraIssueKeys.flatMap(key => {
    const issue = jiraIssuesMap.get(key);
    return issue ? [issue] : [];
  }) || [];

  // Read active pane's actions from derived atom
  const paneActions = useAtomValue(activePaneActionsAtom);

  // Global actions defined inline in App.tsx
  const globalActions: Action[] = useMemo(() => [
    {
      id: 'global:quit',
      keys: [parseKeyString('q')],
      displayKey: 'q',
      description: 'Quit application',
      handler: () => process.exit(),
    },
    {
      id: 'global:toggle-console',
      keys: [parseKeyString('~'), parseKeyString('z')],
      displayKey: '~ / z',
      description: 'Toggle debug console',
      handler: () => renderer.console.toggle(),
    },
    {
      id: 'global:event-log',
      keys: [parseKeyString('o')],
      displayKey: 'o',
      description: 'Open event log',
      handler: () => {
        if (mergeRequests.length > 0) {
          setActiveModal('eventLog');
        }
      },
    },
    {
      id: 'global:refresh',
      keys: [parseKeyString('s')],
      displayKey: 's',
      description: 'Refresh merge requests',
      handler: async () => {
        const mr = await refreshMergeRequests();
        Console.log(mr).pipe(Effect.runPromise);
      },
    },
    {
      id: 'global:help',
      keys: [parseKeyString('?')],
      displayKey: '?',
      description: 'Show help',
      handler: () => setActiveModal('help'),
    },
    {
      id: 'global:dump-state',
      keys: [parseKeyString('0')],
      displayKey: '0',
      description: 'Dump state to debug/',
      handler: async () => {
        await dumpAllMrs();
        setCopyNotification('State dumped to debug/');
        setTimeout(() => setCopyNotification(null), 2000);
      },
    },
    {
      id: 'global:toggle-notifications',
      keys: [parseKeyString('n')],
      displayKey: 'n',
      description: 'Toggle notifications',
      handler: async () => {
        await toggleNotifications();
        setCopyNotification(notificationSettings.enabled ? 'Notifications disabled' : 'Notifications enabled');
        setTimeout(() => setCopyNotification(null), 2000);
      },
    },
    {
      id: 'global:prev-tab',
      keys: [parseKeyString('[')],
      displayKey: '[ / ]',
      description: 'Cycle info tabs',
      handler: () => cycleInfoPaneTab('prev'),
    },
    {
      id: 'global:next-tab',
      keys: [parseKeyString(']'), parseKeyString('tab'), parseKeyString('d'), parseKeyString(';')],
      displayKey: '',
      description: '',
      handler: () => cycleInfoPaneTab('next'),
    },
    {
      id: 'global:jira-board',
      keys: [parseKeyString('b')],
      displayKey: 'b',
      description: 'Open Jira board',
      handler: () => {
        setJiraBoardFocusKey(mergeRequests[selectedIndex]?.jiraIssueKeys[0] ?? null);
        setActiveModal('jiraBoard');
      },
    },
    {
      id: 'global:scroll-down',
      keys: [parseKeyString('ctrl+d')],
      displayKey: 'Ctrl+D/U',
      description: 'Scroll info pane',
      handler: () => {
        if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
          getScroller('infoPane')?.('down');
        }
      },
    },
    {
      id: 'global:scroll-up',
      keys: [parseKeyString('ctrl+u')],
      displayKey: '',
      description: '',
      handler: () => {
        if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
          getScroller('infoPane')?.('up');
        }
      },
    },
    {
      id: 'global:nav-left',
      keys: [parseKeyString('h'), parseKeyString('left')],
      displayKey: 'h/l, ←/→',
      description: 'Navigate panes',
      handler: () => {
        if (activePane === ActivePane.InfoPane) {
          cycleInfoPaneTab('prev');
        } else if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.MergeRequests);
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.Facts);
        }
      },
    },
    {
      id: 'global:nav-right',
      keys: [parseKeyString('l'), parseKeyString('right')],
      displayKey: '',
      description: '',
      handler: () => {
        if (activePane === ActivePane.InfoPane) {
          cycleInfoPaneTab('next');
        } else if (activePane === ActivePane.Facts) {
          setActivePane(ActivePane.MergeRequests);
        } else if (activePane === ActivePane.MergeRequests) {
          setActivePane(ActivePane.UserSelection);
        }
      },
    },
  ], [activePane, mergeRequests.length, notificationSettings.enabled, jiraBoardId]);

  useEffect(() => {
    // renderer.console.toggle();
    const onFocus = () => clearUnreadCount();
    renderer.on('focus', onFocus);
    return () => { renderer.off('focus', onFocus); };

  }, [renderer]);

  const handleStateSelect = async (newState: MergeRequestState) => {
    setFilterMrState(newState);
  };

  const handleSortOrderSelect = (newSortOrder: MrSortOrder) => {
    setSortOrder(newSortOrder);
  };

  // Single keyboard handler for ALL actions
  useKeyboard((key: ParsedKey) => {
    // Handle escape - close any active modal
    if (key.name === 'escape') {
      if (activeModal !== 'none') {
        setActiveModal('none');
        return;
      }
    }

    // When modal is open, only process escape (handled above)
    if (activeModal !== 'none') {
      return;
    }

    // Check pane actions first (more specific), then global
    const allActions = [...paneActions, ...globalActions];
    for (const action of allActions) {
      if (matchesAnyKey(key, action.keys)) {
        action.handler();
        return;
      }
    }
  });

  const infoActive = activePane === ActivePane.InfoPane;

  const getWidths = (): {
    left: RenderableOptions["width"];
    middle: RenderableOptions["width"];
    right: RenderableOptions["width"];
  } => {
    switch (activePane) {
      case ActivePane.Facts:
        return {
          left: "25%",
          middle: "35%",
          right: "40%",
        };

      case ActivePane.UserSelection:
      case ActivePane.MergeRequests:
        return {
          left: "20%",
          middle: "50%",
          right: "30%",
        };

      case ActivePane.InfoPane:
      case ActivePane.Console:
        return {
          left: "20%",
          middle: "30%",
          right: "50%",
        };

      default:
        const _: never = activePane;
        throw new Error("unreachable");
    }
  };

  const widths = getWidths();

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
              width: widths.left,
              backgroundColor: '#282a36'
            }}
        >
            <FactsPane />
        </box>

        {/* Middle panel - two stacked panes */}
        <box style={{ flexDirection: "column", width: widths.middle }}>
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
            width: widths.right,
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

      {/* MR Sort Modal - rendered at app level to cover entire screen */}
      <MrSortModal
        isVisible={activeModal === 'mrSort'}
        currentSortOrder={sortOrder}
        onSortOrderSelect={handleSortOrderSelect}
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
        onError={(message) => {
          setCopyNotification(message);
          setTimeout(() => setCopyNotification(null), 5000);
        }}
      />

      {/* Help Modal - rendered at app level to cover entire screen */}
      <HelpModal
        isVisible={activeModal === 'help'}
        globalActions={globalActions}
        setCopyNotification={setCopyNotification}
      />

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
      {activeModal === 'jobHistory' && (
        <JobHistoryModal
          isVisible={true}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Event Log Pane - fullscreen overlay */}
      {activeModal === 'eventLog' && (
        <EventLogPane
          mergeRequests={[...mergeRequests]}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Jira Board Page - fullscreen overlay */}
      {activeModal === 'jiraBoard' && (
        <JiraBoardPage
          boardId={jiraBoardId}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Monitored MRs Page - fullscreen overlay */}
      {activeModal === 'monitoredMrs' && (
        <MonitoredMergeRequestsPage
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
