import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { UserSelection, UserSelectionEntry } from '../types/userSelection';
import { ActivePane } from '../types/userSelection';
import { useAppStore } from '../store/appStore';

interface UserSelectionPaneProps {
}

interface LocalNavigationState {
  currentItems: UserSelection[];
}

export default function UserSelectionPane({ }: UserSelectionPaneProps) {
  const {
    activePane,
    setSelectedUserSelectionEntry,
    selectedUserSelectionEntry,
    userSelections,
    fetchMrs,
    loadMrs } = useAppStore();

  const isActive = activePane === ActivePane.UserSelection;
  const [navState, setNavState] = useState<LocalNavigationState>(() =>
  ({
    breadcrumb: [],
    currentItems: []
    })
  );
  const [highlightIndex, setHighlightIndex] = useState(selectedUserSelectionEntry);

  useKeyboard((key: ParsedKey) => {
    if (!isActive) {
      return;
    }

    switch (key.name) {
      case 'j':
      case 'down':
        setHighlightIndex(Math.min(highlightIndex + 1, userSelections.length - 1));
        break;
      case 'k':
      case 'up':
        setHighlightIndex(Math.max(highlightIndex - 1, 0));
        break;
      case 'space':
        setSelectedUserSelectionEntry(highlightIndex);
        loadMrs();
        break;
      case 'return': {
        // const highlightedItem = getItemByIndex(navState, highlightIndex);
        // if (highlightedItem && highlightedItem.type === 'group') {
        //   // Navigate into group (replace pane content) and reset highlight
        //   setNavState(prevState => navigateIntoGroup(prevState, highlightedItem));
        //   setHighlightIndex(0);
        // }
        break;
      }
      case 'escape':
        // Reset highlight
        setHighlightIndex(0);
        break;
    }
  });

  const renderItem = (item: UserSelectionEntry, index: number) => {
    const isHighlighted = index === highlightIndex;
    const isSelected = index === selectedUserSelectionEntry;
    const prefix = isSelected ? '* ' : '  ';

    const icon = item.selection.length > 1
      ? item.selection.every(s => s.type === 'userId')
          ? '🧑‍🤝‍🧑'
          : item.selection.every(s => s.type === 'groupId')
            ? '📁'
            : 'm'
      : item.selection[0]?.type === 'userId'
          ? 'u'
          : 'g'

    return (
      <box
        key={`${item.userSelectionEntryId}`}
        style={{
          backgroundColor: isHighlighted ? '#191a21' : 'transparent'
        }}
      >
        <text
          style={{ fg: '#8be9fd' }}
          wrap={false}
        >
          {`${prefix}${icon} ${item.name}`}
        </text>
      </box>
    );
  };

  return (
    <>
      <text
        style={{ fg: '#f8f8f2', marginBottom: 1, attributes: TextAttributes.BOLD }}
        wrap={false}
      >
        User Selection
      </text>

      <box style={{ flexDirection: "column", gap: 0, flexGrow: 1 }}>
        {userSelections.map((item, index) => renderItem(item, index))}
      </box>

    </>
  );
}