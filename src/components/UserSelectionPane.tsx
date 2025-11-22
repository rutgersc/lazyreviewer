import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import type { UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { Colors } from '../colors';
import { activePaneAtom, userSelectionsAtom } from '../store/appAtoms';
import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { openUrl } from '../system/open-url';
import path from 'path';
import { selectedUserSelectionEntryAtom } from '../settings/settings-atom';

interface UserSelectionPaneProps {
}

export default function UserSelectionPane({ }: UserSelectionPaneProps) {
  const activePane = useAtomValue(activePaneAtom);
  const [selectedUserSelectionEntry] = useAtom(selectedUserSelectionEntryAtom);
  const userSelections = useAtomValue(userSelectionsAtom);

  const isActive = activePane === ActivePane.UserSelection;
  const [highlightIndex, setHighlightIndex] = useState(selectedUserSelectionEntry);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  const setSelectedUserSelectionEntry = useAtomSet(selectedUserSelectionEntryAtom)

  const handleTitleClick = useDoubleClick<void>({
    onDoubleClick: () => {
      // We're assuming the process is running from the project root, or we can find the file relative to it.
      // For simplicity in this environment, we'll try to open the file directly.
      // Since 'openUrl' opens URLs, for local files we might need a 'file://' prefix or just the path depending on the system/implementation.
      // However, user asked to open `src\data\usersAndGroups.ts`.
      // Let's try constructing a file URI.
      const filePath = path.resolve('src', 'data', 'usersAndGroups.ts');
      openUrl(filePath); // openUrl usually handles file paths if the system supports it or if we implement it that way.
                         // If openUrl is strict about URLs, we might need `file://${filePath}`.
                         // Given previous context of `openUrl`, it seems to invoke `open` command which handles files.
    }
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
        setSelectedUserSelectionEntry(highlightIndex)
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
        onMouseDown={() => {
          setHighlightIndex(index);
          setSelectedUserSelectionEntry(index);
        }}
        style={{
          backgroundColor: isHighlighted ? '#191a21' : 'transparent'
        }}
      >
        <text
          style={{ fg: '#8be9fd' }}
          wrapMode='none'
        >
          {`${prefix}${icon} ${item.name}`}
        </text>
      </box>
    );
  };

  return (
    <>
      <box style={{ flexDirection: "row", alignItems: "center", marginBottom: 1, gap: 2 }}>
        <text
            onMouseDown={() => handleTitleClick()}
            style={{ fg: '#f8f8f2', attributes: TextAttributes.BOLD }}
            wrapMode='none'
        >
            User Selection
        </text>
        <box
            onMouseDown={() => {
                const filePath = path.resolve('src', 'data', 'usersAndGroups.ts');
                openUrl(filePath);
            }}
            style={{
                backgroundColor: Colors.PRIMARY,
                paddingLeft: 1,
                paddingRight: 1,
            }}
        >
            <text style={{ fg: Colors.BACKGROUND, attributes: TextAttributes.BOLD }} wrapMode='none'>
                Edit
            </text>
        </box>
      </box>

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