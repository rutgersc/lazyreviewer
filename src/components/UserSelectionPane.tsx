import { useState, useEffect, useRef, useMemo } from 'react';
import { TextAttributes } from '@opentui/core';
import type { Action } from '../actions/action-types';
import { parseKeyString } from '../actions/key-matcher';
import { paneActionsAtom } from '../actions/actions-atom';
import type { UserSelectionEntry } from '../userselection/userSelection';
import { ActivePane } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { Colors } from '../colors';
import { activePaneAtom, activeModalAtom } from '../ui/navigation-atom';
import { userSelectionsAtom, selectedUserSelectionEntryAtom } from '../userselection/userselection-atom';
import { useAtom, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { openUrl } from '../system/open-url';
import path from 'path';
import { selectedUserSelectionEntryIdAtom } from '../settings/settings-atom';

interface UserSelectionPaneProps {
}

export default function UserSelectionPane({ }: UserSelectionPaneProps) {
  const hasInitialized = useRef(false);
  const activePane = useAtomValue(activePaneAtom);
  const [selectedUserSelectionEntryId, setSelectedUserSelectionEntryId] = useAtom(selectedUserSelectionEntryIdAtom);
  const userSelections = useAtomValue(userSelectionsAtom);
  const selectedEntry = useAtomValue(selectedUserSelectionEntryAtom);

  const isActive = activePane === ActivePane.UserSelection;
  const [highlightIndex, setHighlightIndex] = useState(0);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({
    lookahead: 2,
  });

  useEffect(() => {
    if (!hasInitialized.current && selectedEntry !== undefined) {
      const index = userSelections.indexOf(selectedEntry);
      setHighlightIndex(index);
      scrollToItem(index);
      hasInitialized.current = true;
    }
  }, [selectedUserSelectionEntryId, selectedEntry]);

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

  const setPaneActions = useAtomSet(paneActionsAtom);
  const activeModal = useAtomValue(activeModalAtom);

  const actions: Action[] = useMemo(() => {
    if (userSelections.length === 0) return [];

    return [
      {
        id: 'userselection:nav-down',
        keys: [parseKeyString('j'), parseKeyString('down')],
        displayKey: 'j/k, ↑/↓',
        description: 'Navigate user selections',
        handler: () => {
          const newIndex = Math.min(highlightIndex + 1, userSelections.length - 1);
          setHighlightIndex(newIndex);
          scrollToItem(newIndex);
        },
      },
      {
        id: 'userselection:nav-up',
        keys: [parseKeyString('k'), parseKeyString('up')],
        displayKey: '',
        description: '',
        handler: () => {
          const newIndex = Math.max(highlightIndex - 1, 0);
          setHighlightIndex(newIndex);
          scrollToItem(newIndex);
        },
      },
      {
        id: 'userselection:select',
        keys: [parseKeyString('space')],
        displayKey: 'Space',
        description: 'Select user/group',
        handler: () => {
          const entry = userSelections[highlightIndex];
          if (entry) {
            setSelectedUserSelectionEntryId(entry.userSelectionEntryId);
          }
        },
      },
      {
        id: 'userselection:reset',
        keys: [parseKeyString('escape')],
        displayKey: 'Esc',
        description: 'Reset highlight',
        handler: () => {
          setHighlightIndex(0);
        },
      },
    ];
  }, [userSelections, highlightIndex, scrollToItem]);

  useEffect(() => {
    if (isActive && activeModal === 'none') {
      setPaneActions(actions);
    }
  }, [isActive, activeModal, actions, setPaneActions]);

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