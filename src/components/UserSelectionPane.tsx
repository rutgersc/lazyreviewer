import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { UserSelection, UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import { useAppStore } from '../store/appStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { Colors } from '../colors';

interface UserSelectionPaneProps {
}

interface LocalNavigationState {
  currentItems: UserSelection[];
}

export default function UserSelectionPane({ }: UserSelectionPaneProps) {
  const activePane = useAppStore(state => state.activePane);
  const selectedUserSelectionEntry = useAppStore(state => state.selectedUserSelectionEntry);
  const userSelections = useAppStore(state => state.userSelections);
  const switchUserSelection = useAppStore(state => state.switchUserSelection);

  const isActive = activePane === ActivePane.UserSelection;
  const [navState, setNavState] = useState<LocalNavigationState>(() =>
  ({
    breadcrumb: [],
    currentItems: []
    })
  );
  const [highlightIndex, setHighlightIndex] = useState(selectedUserSelectionEntry);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    itemHeight: 1,
    lookahead: 2,
  });

  useKeyboard((key: ParsedKey) => {
    if (!isActive) {
      return;
    }

    switch (key.name) {
      case 'j':
      case 'down': {
        const newIndex = Math.min(highlightIndex + 1, userSelections.length - 1);
        setHighlightIndex(newIndex);
        scrollToItem(newIndex);
        break;
      }
      case 'k':
      case 'up': {
        const newIndex = Math.max(highlightIndex - 1, 0);
        setHighlightIndex(newIndex);
        scrollToItem(newIndex);
        break;
      }
      case 'space':
        switchUserSelection(highlightIndex);
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

      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          height: '70%',
          contentOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          viewportOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.TRACK,
            },
          },
        }}
        focused={false}
      >
        {userSelections.map((item, index) => renderItem(item, index))}
      </scrollbox>

    </>
  );
}