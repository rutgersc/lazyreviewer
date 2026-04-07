import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { MrSortOrder } from '../mergerequests/mergerequests-atom';
import { Colors } from '../colors';

interface MrSortModalProps {
  currentSortOrder: MrSortOrder;
  onSortOrderSelect: (sortOrder: MrSortOrder) => void;
  onClose: () => void;
}

const SORT_OPTIONS: Array<{ key: MrSortOrder; label: string }> = [
  { key: 'createdAt', label: 'Created Date' },
  { key: 'updatedAt', label: 'Last Updated' },
];

export default function MrSortModal({
  currentSortOrder,
  onSortOrderSelect,
  onClose
}: MrSortModalProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(
    SORT_OPTIONS.findIndex(opt => opt.key === currentSortOrder)
  );

  useKeyboard((key: ParsedKey) => {
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
          borderColor: Colors.SUCCESS,
          backgroundColor: Colors.BACKGROUND,
          flexDirection: "column",
          minWidth: 50,
          minHeight: 5
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Sort by
        </text>
        {SORT_OPTIONS.map((option, index) => (
          <text
            key={option.key}
            style={{
              fg: index === selectedIndex ? Colors.PRIMARY : Colors.NEUTRAL,
              ...(index === selectedIndex && { bg: Colors.TRACK, attributes: TextAttributes.BOLD }),
            }}
            wrapMode='none'
          >
            {currentSortOrder === option.key ? "● " : "  "}{option.label}
          </text>
        ))}
      </box>
    </box>
  );
}
