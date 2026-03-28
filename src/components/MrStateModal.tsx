import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { MergeRequestState } from '../domain/merge-request-state';
import { Colors } from '../colors';

interface MrStateModalProps {
  isVisible: boolean;
  currentState: MergeRequestState;
  onStateSelect: (state: MergeRequestState) => void;
  onClose: () => void;
}

const STATE_OPTIONS: Array<{ key: MergeRequestState; label: string }> = [
  { key: 'opened', label: 'Open' },
  { key: 'merged', label: 'Merged' },
  { key: 'closed', label: 'Closed' },
  { key: 'locked', label: 'Draft' },
  { key: 'all', label: 'All' },
];

export default function MrStateModal({
  isVisible,
  currentState,
  onStateSelect,
  onClose,
}: MrStateModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(
    STATE_OPTIONS.findIndex(opt => opt.key === currentState)
  );

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, STATE_OPTIONS.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'return': {
        const selected = STATE_OPTIONS[selectedIndex];
        if (selected) {
          onStateSelect(selected.key);
          onClose();
        }
        break;
      }
      case 'escape':
        onClose();
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
        width: "100%",
        height: "100%",
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <box
        style={{
          border: true,
          borderColor: Colors.SUCCESS,
          backgroundColor: Colors.BACKGROUND,
          flexDirection: "column",
          minWidth: 30,
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          MR State
        </text>
        {STATE_OPTIONS.map((option, index) => (
          <text
            key={option.key}
            onMouseDown={() => { onStateSelect(option.key); onClose(); }}
            style={{
              fg: index === selectedIndex ? Colors.PRIMARY : Colors.NEUTRAL,
              ...(index === selectedIndex && { bg: Colors.TRACK, attributes: TextAttributes.BOLD }),
            }}
            wrapMode='none'
          >
            {currentState === option.key ? "● " : "  "}{option.label}
          </text>
        ))}
      </box>
    </box>
  );
}
