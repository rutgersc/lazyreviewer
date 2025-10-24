import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { type MergeRequestState } from '../generated/gitlab-sdk';

interface MrStateFilterModalProps {
  isVisible: boolean;
  currentState: MergeRequestState;
  onStateSelect: (state: MergeRequestState) => void;
  onClose: () => void;
}

const MR_STATES: Array<{ key: MergeRequestState; label: string; description: string }> = [
  { key: 'opened', label: 'Open', description: 'Currently open merge requests' },
  { key: 'merged', label: 'Merged', description: 'Successfully merged requests' },
  { key: 'closed', label: 'Closed', description: 'Closed without merging' },
  { key: 'all', label: 'All', description: 'All merge requests regardless of state' },
];

export default function MrStateFilterModal({
  isVisible,
  currentState,
  onStateSelect,
  onClose
}: MrStateFilterModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(
    MR_STATES.findIndex(state => state.key === currentState)
  );

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, MR_STATES.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'return':
        if (MR_STATES[selectedIndex]) {
          onStateSelect(MR_STATES[selectedIndex].key);
          onClose();
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
        width: "100%",
        height: "100%",
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <box
        style={{
          border: true,
          borderColor: "#50fa7b",
          backgroundColor: '#282a36',
          padding: 2,
          width: 70,
          flexDirection: "column"
        }}
      >
        <text
          style={{ fg: '#50fa7b', marginBottom: 1, attributes: TextAttributes.BOLD }}
          wrapMode='none'
        >
          🔍 Filter Merge Requests by State
        </text>

        <box style={{ flexDirection: "column", gap: 0.5 }}>
          {MR_STATES.map((state, index) => (
            <box
              key={state.key}
              style={{
                flexDirection: "row",
                backgroundColor: index === selectedIndex ? '#44475a' : 'transparent',
                padding: 0.5,
                alignItems: "center"
              }}
            >
              <box style={{ width: 3 }}>
                <text
                  style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }}
                  wrapMode='none'
                >
                  {currentState === state.key ? "●" : " "}
                </text>
              </box>
              <box style={{ width: 12 }}>
                <text
                  style={{
                    fg: index === selectedIndex ? '#f8f8f2' : '#bd93f9',
                    attributes: index === selectedIndex ? TextAttributes.BOLD : undefined
                  }}
                  wrapMode='none'
                >
                  {state.label}
                </text>
              </box>
              <box style={{ flexGrow: 1 }}>
                <text
                  style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
                  wrapMode='none'
                >
                  {state.description}
                </text>
              </box>
            </box>
          ))}
        </box>

        <text
          style={{ fg: '#bd93f9', marginTop: 1, attributes: TextAttributes.DIM }}
          wrapMode='none'
        >
          Use j/k to navigate, Return to select, Esc to cancel
        </text>
      </box>
    </box>
  );
}