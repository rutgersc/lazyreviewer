import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey, type RenderableOptions } from '@opentui/core';
import RepositoriesPane from "./components/RepositoriesPane";
import MergeRequestPane from "./components/MergeRequestPane";
import InfoPane from "./components/InfoPane";
import ConsolePane from "./components/ConsolePane";
import FactsPane from "./components/FactsPane";
import MrSortModal from "./components/MrSortModal";
import MrStateModal from "./components/MrStateModal";
import RepoFilterModal from "./components/RepoFilterModal";
import FChooserModal from "./components/FChooserModal";
import UserFilterModal from "./components/UserFilterModal";
import UserFilterBar from "./components/UserFilterBar";
import GitSwitchModal from "./components/GitSwitchModal";
import HelpModal from "./components/HelpModal";
import JobHistoryModal from "./components/JobHistoryModal";
import JobHistoryInputModal from "./components/JobHistoryInputModal";
import EventLogPane from "./components/EventLogPane";
import { JiraBoardPage } from "./jiraboard";
import MonitoredMergeRequestsPage from "./components/MonitoredMergeRequestsPage";
import NotificationsPage from "./components/NotificationsPage";
import FailedJobPickerModal from "./components/FailedJobPickerModal";
import ConfigurationPage from "./components/ConfigurationPage";
import OnboardingPage from "./onboarding/OnboardingPage";
import { ActivePane } from "./userselection/userSelection";
import { useEffect, useMemo, useState } from 'react';
import type { Action } from './actions/action-types';
import { parseKeyString, matchesAnyKey } from './actions/key-matcher';
import { activePaneActionsAtom } from './actions/pane-actions-atoms';
import { type MergeRequestState } from "./domain/merge-request-state";
import { getScroller } from "./hooks/useScrollBox";
import { useAtom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { filterMrStateAtom, refreshMergeRequestsAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, mrSortOrderAtom, repoFilterAtom, type MrSortOrder } from './mergerequests/mergerequests-atom';
import { toggleNotificationsAtom, notificationSettingsAtom, toggleBackgroundSyncAtom, backgroundSyncSettingsAtom, jiraBoardIdAtom, appViewAtom, setUserFilterAtom, isOnboardingCompleteAtom, repoSelectionAtom, repositoryPathsAtom } from './settings/settings-atom';
import { activePaneAtom, activeModalAtom, cycleInfoPaneTabAtom } from './ui/navigation-atom';
import { jiraBoardFocusKeyAtom } from './jiraboard/atoms';
import { Console, Effect } from 'effect';
import { appLayer } from './appLayerRuntime';
import { openFileInEditor } from './utils/open-file';
import { appInitAtom } from './app-init';
import { clearUnreadCount } from './notifications/title-indicator';
import { missingCredentialsAtom } from './config/config-atom';

export default function App() {
  useAtomValue(appInitAtom);

  const refreshMergeRequests = useAtomSet(refreshMergeRequestsAtom, { mode: 'promiseExit' });
  const toggleNotifications = useAtomSet(toggleNotificationsAtom, { mode: 'promiseExit' });
  const notificationSettings = useAtomValue(notificationSettingsAtom);
  const toggleBackgroundSync = useAtomSet(toggleBackgroundSyncAtom, { mode: 'promiseExit' });
  const backgroundSyncSettings = useAtomValue(backgroundSyncSettingsAtom);

  const renderer = useRenderer();
  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const [activeModal, setActiveModal] = useAtom(activeModalAtom);
  const cycleInfoPaneTab = useAtomSet(cycleInfoPaneTabAtom);

  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const [selectedIndex] = useAtom(selectedMrIndexAtom);

  const repositoryPaths = useAtomValue(repositoryPathsAtom);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // Data sources
  const missingCredentialsResult = useAtomValue(missingCredentialsAtom);
  const isOnboardingComplete = useAtomValue(isOnboardingCompleteAtom);
  const setRepoSelection = useAtomSet(repoSelectionAtom);

  // Only local UI state: user dismissed the config page this session
  const [configDismissed, setConfigDismissed] = useState(false);

  // Pure derivations — no useEffect
  const credentialsLoaded = missingCredentialsResult._tag === 'Success';
  const missingCredentials = credentialsLoaded ? missingCredentialsResult.value : [];

  const showConfigPage = credentialsLoaded && !configDismissed && (
    missingCredentials.some(c => c.required) ||
    (!isOnboardingComplete && missingCredentials.length > 0)
  );
  const showOnboarding = !showConfigPage && !isOnboardingComplete && credentialsLoaded;

  const [filterMrState, setFilterMrState] = useAtom(filterMrStateAtom);
  const [repoFilter, setRepoFilter] = useAtom(repoFilterAtom);
  const [sortOrder, setSortOrder] = useAtom(mrSortOrderAtom);
  const [appView, setAppView] = useAtom(appViewAtom);
  const setUserFilter = useAtomSet(setUserFilterAtom);
  const jiraBoardId = useAtomValue(jiraBoardIdAtom);
  const setJiraBoardFocusKey = useAtomSet(jiraBoardFocusKeyAtom);

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
      id: 'global:toggle-background-sync',
      keys: [parseKeyString('S')],
      displayKey: 'S',
      description: 'Toggle background sync',
      handler: async () => {
        await toggleBackgroundSync();
        setCopyNotification(backgroundSyncSettings.enabled ? 'Background sync disabled' : 'Background sync enabled');
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
      id: 'global:toggle-view',
      keys: [parseKeyString('v')],
      displayKey: 'v',
      description: 'Toggle review/focus mode',
      handler: () => setAppView(appView === 'review' ? 'focus' : 'review'),
    },
    {
      id: 'global:onboarding',
      keys: [parseKeyString('shift+o')],
      displayKey: 'Shift+O',
      description: 'Re-run onboarding',
      handler: () => setRepoSelection([]),
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
        } else if (activePane === ActivePane.Facts) {
          setActivePane(ActivePane.UserSelection);
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
        } else if (activePane === ActivePane.UserSelection) {
          setActivePane(ActivePane.Facts);
        }
      },
    },
    {
      id: 'global:job-history-input',
      keys: [parseKeyString('Y')],
      displayKey: 'Y',
      description: 'Job history lookup',
      handler: () => setActiveModal('jobHistoryInput'),
    },
    {
      id: 'global:notifications-page',
      keys: [parseKeyString('N')],
      displayKey: 'N',
      description: 'Notification settings',
      handler: () => setActiveModal('notifications'),
    },
    {
      id: 'global:open-settings',
      keys: [parseKeyString(',')],
      displayKey: ',',
      description: 'Open settings JSON',
      handler: async () => {
        await Effect.runPromise(
          openFileInEditor('lazygitlab-settings.json').pipe(Effect.provide(appLayer))
        );
      },
    },
  ], [activePane, mergeRequests.length, notificationSettings.enabled, backgroundSyncSettings.enabled, jiraBoardId, appView]);

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

    // When modal is open or onboarding is showing, only process escape (handled above)
    if (activeModal !== 'none' || showOnboarding) {
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

        {/* Left panel - Facts and Repositories */}
        <box style={{ flexDirection: "column", width: widths.left }}>
          {/* Facts Pane */}
          <box
              style={{
                flexDirection: "column",
                border: true,
                borderColor: activePane === ActivePane.Facts ? "#50fa7b" : "#6272a4",
                height: "80%",
                backgroundColor: '#282a36'
              }}
          >
              <FactsPane />
          </box>

          {/* Repositories Pane */}
          <box
            onMouseDown={() => setActivePane(ActivePane.UserSelection)}
            style={{
              flexDirection: "column",
              border: true,
              borderColor: activePane === ActivePane.UserSelection ? "#50fa7b" : "#6272a4",
              height: "20%",
              backgroundColor: '#282a36'
            }}
          >
            <RepositoriesPane />
          </box>
        </box>

        {/* Middle panel - Merge Request Pane */}
        <box
          style={{
            flexDirection: "column",
            border: true,
            borderColor: activePane === ActivePane.MergeRequests ? "#50fa7b" : "#6272a4",
            width: widths.middle,
            backgroundColor: '#282a36'
          }}
        >
          <MergeRequestPane />
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

      {/* F Chooser Modal - pick filter or sort */}
      <FChooserModal
        isVisible={activeModal === 'fChooser'}
        onChoose={(modal) => setActiveModal(modal)}
        onClose={() => setActiveModal('none')}
      />

      {/* User Filter Modal - toggle user filter */}
      <UserFilterModal
        isVisible={activeModal === 'userFilter'}
        onConfirm={(usernames, groupIds) => {
          setUserFilter({ usernames, groupIds });
          setActiveModal('none');
        }}
        onClose={() => setActiveModal('none')}
      />

      <MrSortModal
        isVisible={activeModal === 'mrSort'}
        currentSortOrder={sortOrder}
        onSortOrderSelect={handleSortOrderSelect}
        onClose={() => setActiveModal('none')}
      />

      <MrStateModal
        isVisible={activeModal === 'mrState'}
        currentState={filterMrState}
        onStateSelect={(state) => setFilterMrState(state)}
        onClose={() => setActiveModal('none')}
      />

      <RepoFilterModal
        isVisible={activeModal === 'repoFilter'}
        currentFilter={repoFilter}
        onConfirm={(filter) => { setRepoFilter(filter); setActiveModal('none'); }}
        onClose={() => setActiveModal('none')}
      />

      {/* Git Switch Modal - rendered at app level to cover entire screen */}
      <GitSwitchModal
        isVisible={activeModal === 'gitSwitch'}
        branchName={mergeRequests[selectedIndex]?.sourcebranch || ""}
        repoPath={mergeRequests[selectedIndex] ? repositoryPaths[mergeRequests[selectedIndex].project.fullPath]?.localPath || null : null}
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

      {/* Job History Input Modal - standalone lookup */}
      {activeModal === 'jobHistoryInput' && (
        <JobHistoryInputModal
          onClose={() => setActiveModal('none')}
        />
      )}

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

      {/* Failed Job Picker Modal */}
      {activeModal === 'failedJobPicker' && (
        <FailedJobPickerModal
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Notifications Page - fullscreen overlay */}
      {activeModal === 'notifications' && (
        <NotificationsPage
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Onboarding Page - shown after config, before normal use */}
      {showOnboarding && (
        <OnboardingPage />
      )}

      {/* Configuration Page - fullscreen overlay with highest priority */}
      {showConfigPage && (
        <ConfigurationPage
          missingCredentials={missingCredentials}
          onClose={() => setConfigDismissed(true)}
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
