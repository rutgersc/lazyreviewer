import React, { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { ActivePane } from '../userselection/userSelection';
import { Colors } from '../colors';
import type { Action } from '../actions/action-types';
import { infoPaneTabAtom, activePaneAtom, activeModalAtom, type InfoPaneTab } from '../ui/navigation-atom';
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react';

interface HelpModalProps {
  isVisible: boolean;
  paneActions: Action[];
  globalActions: Action[];
  setCopyNotification?: (notification: string | null) => void;
}

interface KeyBinding {
  key: string;
  description: string;
  action?: () => void;
}

const KeyRow = ({
  binding,
  isSelected,
}: {
  binding: KeyBinding;
  isSelected: boolean;
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
    case ActivePane.Facts: return 'Facts Pane';
  }

  return '';
};

// Convert Action[] to KeyBinding[] for display
const actionsToKeyBindings = (actions: Action[]): KeyBinding[] => {
  return actions
    .filter(a => a.displayKey && a.description) // Only show actions with display info
    .map(action => ({
      key: action.displayKey,
      description: action.description,
      action: action.handler,
    }));
};

export default function HelpModal({ isVisible, paneActions, globalActions }: HelpModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activePane = useAtomValue(activePaneAtom);
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const setActiveModal = useAtomSet(activeModalAtom);

  // Convert actions to key bindings for display
  const paneKeys = actionsToKeyBindings(paneActions);
  const globalKeys = actionsToKeyBindings(globalActions);
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
          setActiveModal('none');
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
          LazyGitLab - Keyboard Shortcuts
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
