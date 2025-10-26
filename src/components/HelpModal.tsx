import React, { useState } from 'react';
import { useKeyboard, useRenderer } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import { type InfoPaneTab, useAppStore } from '../store/appStore';
import { openSettingsFile } from '../settings/settings';
import { copyToClipboard } from '../system/clipboard-effect';
import { openUrl } from '../system/url-effect';
import { getScroller } from '../hooks/useScrollBox';
import { cycleInfoPaneTabAtom, infoPaneTabAtom, activePaneAtom, activeModalAtom, selectedMrIndexAtom, unwrappedMergeRequestsAtom, toggleIgnoreMergeRequestAtom } from '../store/appAtoms';
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react';

interface HelpModalProps {
  isVisible: boolean;
  setCopyNotification?: (notification: string | null) => void;
}

export interface HelpModalActions {
  // Global actions
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onToggleConsole?: () => void;
  onOpenEventLog?: () => void;
  onCycleInfoTab?: () => void;
  onScrollInfoPaneDown?: () => void;
  onScrollInfoPaneUp?: () => void;
  onCyclePaneRight?: () => void;
  onCyclePaneLeft?: () => void;

  // MR Pane actions
  onFocusInfoPane?: () => void;
  onFilterMRs?: () => void;
  onCopyBranch?: () => void;
  onOpenInBrowser?: () => void;
  onGitSwitch?: () => void;
  onShowJiraTickets?: () => void;
  onRetargetMR?: () => void;
  onToggleIgnore?: () => void;

  // User Selection Pane actions
  onSelectEntry?: () => void;
  onResetHighlight?: () => void;
}

interface KeyBinding {
  key: string;
  description: string;
  action?: () => void;
}

const buildPaneKeys = (activePane: ActivePane, infoPaneTab: InfoPaneTab, actions: HelpModalActions): KeyBinding[] => {
  switch (activePane) {
    case ActivePane.MergeRequests:
      return [
        { key: 'j/k, ↑/↓', description: 'Navigate list' },
        { key: 'h/l, ←/→', description: 'Toggle MR/User panes' },
        { key: 'Enter', description: 'Focus info pane', action: actions.onFocusInfoPane },
        { key: 'f', description: 'Filter MRs by state', action: actions.onFilterMRs },
        { key: 'c', description: 'Copy branch name', action: actions.onCopyBranch },
        { key: 'x', description: 'Open MR in browser', action: actions.onOpenInBrowser },
        { key: 'g', description: 'Git switch to branch', action: actions.onGitSwitch },
        { key: 't', description: 'Show Jira tickets', action: actions.onShowJiraTickets },
        { key: 'r', description: 'Retarget MR to branch', action: actions.onRetargetMR },
        { key: 'Backspace', description: 'Toggle ignore MR', action: actions.onToggleIgnore },
      ];
    case ActivePane.InfoPane:
      // Return tab-specific keys
      switch (infoPaneTab) {
        case 'overview':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate discussions' },
            { key: 'h/l, ←/→', description: 'Cycle tabs' },
            { key: 'i', description: 'Open discussion in browser' },
            { key: 'c', description: 'Copy discussion URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'jira':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate Jira issues' },
            { key: 'h/l, ←/→', description: 'Cycle tabs' },
            { key: 'i, Enter', description: 'Open issue in browser' },
            { key: 'c', description: 'Copy issue URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'pipeline':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate pipeline jobs' },
            { key: 'h/l, ←/→', description: 'Cycle tabs' },
            { key: 'i', description: 'Download and open job log' },
            { key: 'y', description: 'View job history (all branches)' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'activity':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate activity items' },
            { key: 'h/l, ←/→', description: 'Cycle tabs' },
            { key: 'i, Enter', description: 'Open event (job log/URL)' },
            { key: 'c', description: 'Copy event URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        default:
          return [
            { key: 'h/l, ←/→', description: 'Cycle tabs' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
      }
    case ActivePane.UserSelection:
      return [
        { key: 'j/k, ↑/↓', description: 'Navigate list' },
        { key: 'h/l, ←/→', description: 'Toggle MR/User panes' },
        { key: 'Space', description: 'Select entry and load MRs', action: actions.onSelectEntry },
        { key: 'Esc', description: 'Reset highlight', action: actions.onResetHighlight },
      ];
    case ActivePane.Console:
      return [];
  }
  return [];
};

const buildGlobalKeys = (actions: HelpModalActions): KeyBinding[] => [
  { key: 'q, Ctrl+C', description: 'Quit application', action: () => process.exit() },
  { key: 's', description: 'Refresh merge requests', action: actions.onRefresh },
  { key: 'Ctrl+S', description: 'Open settings file', action: actions.onOpenSettings },
  { key: '?', description: 'Show this help' },
  { key: '~', description: 'Toggle console', action: actions.onToggleConsole },
  { key: 'o', description: 'Open event log', action: actions.onOpenEventLog },
  { key: '[, ], Tab, d', description: 'Cycle info tabs', action: actions.onCycleInfoTab },
  { key: 'Ctrl+D/U', description: 'Scroll info pane', action: actions.onScrollInfoPaneDown },
  { key: 'Esc', description: 'Close modals/overlays' },
];

const KeyRow = ({
  binding,
  isSelected,
  key
}: {
  binding: KeyBinding;
  isSelected: boolean;
  key?: string | number;
}) => (
  <box
    style={{
      flexDirection: "row",
      backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
      paddingLeft: 0.5,
      paddingRight: 0.5,
    }}
  >
    <box style={{ width: 18 }}>
      <text
        style={{
          fg: Colors.WARNING,
          attributes: isSelected ? TextAttributes.BOLD : undefined
        }}
        wrapMode='none'
      >
        {binding.key}
      </text>
    </box>
    <text
      style={{
        fg: Colors.PRIMARY,
        attributes: isSelected ? TextAttributes.BOLD : undefined
      }}
      wrapMode='none'
    >
      {binding.description}
    </text>
  </box>
);

const getPaneTitle = (pane: ActivePane, infoPaneTab?: InfoPaneTab): string => {
  switch (pane) {
    case ActivePane.MergeRequests: return 'Merge Requests Pane';
    case ActivePane.InfoPane:
      if (infoPaneTab === 'overview') return 'Info Pane - Overview Tab';
      if (infoPaneTab === 'jira') return 'Info Pane - Jira Tab';
      if (infoPaneTab === 'pipeline') return 'Info Pane - Pipeline Tab';
      if (infoPaneTab === 'activity') return 'Info Pane - Activity Tab';
      return 'Info Pane';
    case ActivePane.UserSelection: return 'User Selection Pane';
    case ActivePane.Console: return 'Console Pane';
  }
};

export default function HelpModal({ isVisible, setCopyNotification }: HelpModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const renderer = useRenderer();

  // Store selectors
  const activePane = useAtomValue(activePaneAtom);
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const setActivePane = useAtomSet(activePaneAtom);
  const setActiveModal = useAtomSet(activeModalAtom);
  const cycleInfoPaneTab = useAtomSet(cycleInfoPaneTabAtom);

  const fetchMrs = useAppStore(state => state.fetchMrs);
  const loadMrs = useAppStore(state => state.loadMrs);
  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const selectedMrIndex = useAtomValue(selectedMrIndexAtom);
  const toggleIgnoreMergeRequest = useAtomSet(toggleIgnoreMergeRequestAtom);

  // Build help modal actions
  const actions: HelpModalActions = {
    // Global actions
    onRefresh: () => {
      setActiveModal('none');
      fetchMrs();
    },
    onOpenSettings: () => {
      setActiveModal('none');
      openSettingsFile();
    },
    onToggleConsole: () => {
      setActiveModal('none');
      renderer.console.toggle();
    },
    onOpenEventLog: () => {
      if (mergeRequests.length > 0) {
        setActiveModal('eventLog');
      }
    },
    onCycleInfoTab: () => {
      setActiveModal('none');
      cycleInfoPaneTab('next');
    },
    onScrollInfoPaneDown: () => {
      setActiveModal('none');
      if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
        getScroller('infoPane')?.('down');
      }
    },
    onScrollInfoPaneUp: () => {
      setActiveModal('none');
      if (activePane === ActivePane.MergeRequests || activePane === ActivePane.InfoPane) {
        getScroller('infoPane')?.('up');
      }
    },
    onCyclePaneRight: () => {
      setActiveModal('none');
      if (activePane === ActivePane.MergeRequests) {
        setActivePane(ActivePane.UserSelection);
      } else {
        setActivePane(ActivePane.MergeRequests);
      }
    },
    onCyclePaneLeft: () => {
      setActiveModal('none');
      if (activePane === ActivePane.MergeRequests) {
        setActivePane(ActivePane.UserSelection);
      } else {
        setActivePane(ActivePane.MergeRequests);
      }
    },

    // MR Pane actions
    onFocusInfoPane: () => {
      setActiveModal('none');
      setActivePane(ActivePane.InfoPane);
    },
    onFilterMRs: () => {
      setActiveModal('mrFilter');
    },
    onCopyBranch: () => {
      setActiveModal('none');
      if (mergeRequests[selectedMrIndex]) {
        const sourceBranch = mergeRequests[selectedMrIndex].sourcebranch;
        copyToClipboard(sourceBranch).then((success) => {
          if (success && setCopyNotification) {
            setCopyNotification(`Copied: ${sourceBranch}`);
            setTimeout(() => setCopyNotification(null), 2000);
          }
        });
      }
    },
    onOpenInBrowser: () => {
      setActiveModal('none');
      if (mergeRequests[selectedMrIndex]) {
        openUrl(mergeRequests[selectedMrIndex].webUrl);
      }
    },
    onGitSwitch: () => {
      setActiveModal('gitSwitch');
    },
    onShowJiraTickets: () => {
      setActiveModal('jira');
    },
    onRetargetMR: () => {
      setActiveModal('retarget');
    },
    onToggleIgnore: () => {
      setActiveModal('none');
      if (mergeRequests[selectedMrIndex]) {
        toggleIgnoreMergeRequest(mergeRequests[selectedMrIndex].id);
      }
    },

    // User Selection Pane actions
    onSelectEntry: () => {
      setActiveModal('none');
      loadMrs();
    },
    onResetHighlight: () => {
      setActiveModal('none');
      // This would need to be implemented via store if needed
    },
  };

  const paneKeys = buildPaneKeys(activePane, infoPaneTab, actions);
  const globalKeys = buildGlobalKeys(actions);
  const allKeys = [...paneKeys, ...globalKeys];

  // Reset selection when modal opens or pane changes
  React.useEffect(() => {
    if (isVisible) {
      setSelectedIndex(0);
    }
  }, [isVisible, activePane]);

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, allKeys.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'return':
        const selectedBinding = allKeys[selectedIndex];
        if (selectedBinding?.action) {
          selectedBinding.action();
        }
        break;
    }
  });

  if (!isVisible) return null;

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <box
        style={{
          border: true,
          borderColor: Colors.SUCCESS,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          width: 70,
          maxHeight: 30,
          flexDirection: "column"
        }}
      >
        <text style={{ fg: Colors.SUCCESS, marginBottom: 1, attributes: TextAttributes.BOLD }} wrapMode='none'>
          🚀 LazyGitLab - Keyboard Shortcuts
        </text>

        {/* Pane-specific keys */}
        {paneKeys.length > 0 && (
          <>
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD, marginTop: 0.5 }} wrapMode='none'>
              {getPaneTitle(activePane, infoPaneTab)}
            </text>
            <box style={{ flexDirection: "column", gap: 0.3, marginBottom: 1 }}>
              {paneKeys.map((binding, index) => (
                <KeyRow key={index} binding={binding} isSelected={index === selectedIndex} />
              ))}
            </box>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL, marginBottom: 0.5 }} wrapMode='none'>
              {'─'.repeat(60)}
            </text>
          </>
        )}

        {/* Global keys */}
        <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Global Keys
        </text>
        <box style={{ flexDirection: "column", gap: 0.3 }}>
          {globalKeys.map((binding, index) => (
            <KeyRow
              key={index}
              binding={binding}
              isSelected={paneKeys.length + index === selectedIndex}
            />
          ))}
        </box>

        <text style={{ fg: Colors.NEUTRAL, marginTop: 1, attributes: TextAttributes.DIM }} wrapMode='none'>
          j/k: Navigate • Enter: Execute • Esc: Close
        </text>
      </box>
    </box>
  );
}