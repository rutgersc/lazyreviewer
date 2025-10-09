import React, { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import { type InfoPaneTab } from '../store/appStore';

interface HelpModalProps {
  isVisible: boolean;
  activePane: ActivePane;
  infoPaneTab: InfoPaneTab;
  actions: HelpModalActions;
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
        { key: 'Enter', description: 'Focus info pane', action: actions.onFocusInfoPane },
        { key: 'f', description: 'Filter MRs by state', action: actions.onFilterMRs },
        { key: 'c', description: 'Copy branch name', action: actions.onCopyBranch },
        { key: 'x', description: 'Open MR in browser', action: actions.onOpenInBrowser },
        { key: 'g', description: 'Git switch to branch', action: actions.onGitSwitch },
        { key: 't', description: 'Show Jira tickets', action: actions.onShowJiraTickets },
        { key: 'Backspace', description: 'Toggle ignore MR', action: actions.onToggleIgnore },
      ];
    case ActivePane.InfoPane:
      // Return tab-specific keys
      switch (infoPaneTab) {
        case 'overview':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate discussions' },
            { key: 'i', description: 'Open discussion in browser' },
            { key: 'c', description: 'Copy discussion URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'jira':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate Jira issues' },
            { key: 'i, Enter', description: 'Open issue in browser' },
            { key: 'c', description: 'Copy issue URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'pipeline':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate pipeline jobs' },
            { key: 'i', description: 'Download and open job log' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        case 'activity':
          return [
            { key: 'j/k, ↑/↓', description: 'Navigate activity items' },
            { key: 'i, Enter', description: 'Open event (job log/URL)' },
            { key: 'c', description: 'Copy event URL' },
            { key: 'Esc', description: 'Return to MR pane' },
          ];
        default:
          return [
            { key: 'Esc', description: 'Return to MR pane' },
          ];
      }
    case ActivePane.UserSelection:
      return [
        { key: 'j/k, ↑/↓', description: 'Navigate list' },
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
  { key: 'h/l, ←/→', description: 'Cycle panes', action: actions.onCyclePaneRight },
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
        wrap={false}
      >
        {binding.key}
      </text>
    </box>
    <text
      style={{
        fg: Colors.PRIMARY,
        attributes: isSelected ? TextAttributes.BOLD : undefined
      }}
      wrap={false}
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

export default function HelpModal({ isVisible, activePane, infoPaneTab, actions }: HelpModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

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
        <text style={{ fg: Colors.SUCCESS, marginBottom: 1, attributes: TextAttributes.BOLD }} wrap={false}>
          🚀 LazyGitLab - Keyboard Shortcuts
        </text>

        {/* Pane-specific keys */}
        {paneKeys.length > 0 && (
          <>
            <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD, marginTop: 0.5 }} wrap={false}>
              {getPaneTitle(activePane, infoPaneTab)}
            </text>
            <box style={{ flexDirection: "column", gap: 0.3, marginBottom: 1 }}>
              {paneKeys.map((binding, index) => (
                <KeyRow key={index} binding={binding} isSelected={index === selectedIndex} />
              ))}
            </box>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL, marginBottom: 0.5 }} wrap={false}>
              {'─'.repeat(60)}
            </text>
          </>
        )}

        {/* Global keys */}
        <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrap={false}>
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

        <text style={{ fg: Colors.NEUTRAL, marginTop: 1, attributes: TextAttributes.DIM }} wrap={false}>
          j/k: Navigate • Enter: Execute • Esc: Close
        </text>
      </box>
    </box>
  );
}