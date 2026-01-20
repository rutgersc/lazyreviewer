import { useEffect, useRef } from 'react';
import { TextAttributes } from '@opentui/core';
import type { UserSelectionEntry } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { Colors } from '../colors';
import { userSelectionsAtom, selectedUserSelectionEntryAtom } from '../userselection/userselection-atom';
import { useAtom, useAtomValue, Atom } from '@effect-atom/atom-react';
import { openUrl } from '../system/open-url';
import path from 'path';
import { selectedUserSelectionEntryIdAtom } from '../settings/settings-atom';

export const highlightIndexAtom = Atom.make(0);
export const scrollToItemRequestAtom = Atom.make<number | null>(null);

export default function UserSelectionPane() {
  const hasInitialized = useRef(false);
  const [selectedUserSelectionEntryId, setSelectedUserSelectionEntryId] = useAtom(selectedUserSelectionEntryIdAtom);
  const userSelections = useAtomValue(userSelectionsAtom);
  const selectedEntry = useAtomValue(selectedUserSelectionEntryAtom);
  const [highlightIndex, setHighlightIndex] = useAtom(highlightIndexAtom);
  const [scrollToItemRequest, setScrollToItemRequest] = useAtom(scrollToItemRequestAtom);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  // Handle initial scroll to selected entry
  useEffect(() => {
    if (!hasInitialized.current && selectedEntry !== undefined) {
      const index = userSelections.indexOf(selectedEntry);
      setHighlightIndex(index);
      scrollToItem(index);
      hasInitialized.current = true;
    }
  }, [selectedUserSelectionEntryId, selectedEntry, userSelections, setHighlightIndex, scrollToItem]);

  // Handle scroll requests from actions
  useEffect(() => {
    if (scrollToItemRequest !== null) {
      scrollToItem(scrollToItemRequest);
      setScrollToItemRequest(null);
    }
  }, [scrollToItemRequest, scrollToItem, setScrollToItemRequest]);

  const handleTitleClick = useDoubleClick<void>({
    onDoubleClick: () => {
      const filePath = path.resolve('src', 'data', 'usersAndGroups.ts');
      openUrl(filePath);
    }
  });

  const renderItem = (item: UserSelectionEntry, index: number) => {
    const isHighlighted = index === highlightIndex;
    const isSelected = item.userSelectionEntryId === selectedUserSelectionEntryId;
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
          setSelectedUserSelectionEntryId(item.userSelectionEntryId);
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