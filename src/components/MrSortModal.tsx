import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { MrSortOrder } from '../mergerequests/mergerequests-atom';

interface MrSortModalProps {
  isVisible: boolean;
  currentSortOrder: MrSortOrder;
  onSortOrderSelect: (sortOrder: MrSortOrder) => void;
  onClose: () => void;
}

const SORT_OPTIONS: Array<{ key: MrSortOrder; label: string; description: string }> = [
  { key: 'updatedAt', label: 'Last Updated', description: 'Most recently updated first' },
  { key: 'createdAt', label: 'Created Date', description: 'Most recently created first' },
];

export default function MrSortModal({
  isVisible,
  currentSortOrder,
  onSortOrderSelect,
  onClose
}: MrSortModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(
    SORT_OPTIONS.findIndex(opt => opt.key === currentSortOrder)
  );

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, SORT_OPTIONS.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'return':
        if (SORT_OPTIONS[selectedIndex]) {
          onSortOrderSelect(SORT_OPTIONS[selectedIndex].key);
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
          width: 60,
          flexDirection: "column"
        }}
      >
        <text
          style={{ fg: '#50fa7b', marginBottom: 1, attributes: TextAttributes.BOLD }}
          wrapMode='none'
        >
          Sort Merge Requests
        </text>

        <box style={{ flexDirection: "column", gap: 0.5 }}>
          {SORT_OPTIONS.map((option, index) => (
            <box
              key={option.key}
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
                  {currentSortOrder === option.key ? "●" : " "}
                </text>
              </box>
              <box style={{ width: 16 }}>
                <text
                  style={{
                    fg: index === selectedIndex ? '#f8f8f2' : '#bd93f9',
                    attributes: index === selectedIndex ? TextAttributes.BOLD : undefined
                  }}
                  wrapMode='none'
                >
                  {option.label}
                </text>
              </box>
              <box style={{ flexGrow: 1 }}>
                <text
                  style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
                  wrapMode='none'
                >
                  {option.description}
                </text>
              </box>
            </box>
          ))}
        </box>

        <text
          style={{ fg: '#bd93f9', marginTop: 1, attributes: TextAttributes.DIM }}
          wrapMode='none'
        >
          j/k to navigate, Return to select, Esc to cancel
        </text>
      </box>
    </box>
  );
}
