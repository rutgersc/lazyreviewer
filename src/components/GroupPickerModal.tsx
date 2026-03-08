import { useState } from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { userGroupsAtom, setUserFilterAtom, saveGroupFromFilterAtom, deleteGroupAtom, moveGroupAtom } from '../settings/settings-atom';
import { matchesAnyKey, parseKeyString } from '../actions/key-matcher';
import PickerModal, { type PickerItem, type PickerHint } from './PickerModal';
import type { SettingsGroup } from '../data/default-users-and-groups';

type Mode = 'pick' | 'naming'

interface GroupPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onEditFilter: () => void;
}

const KEY_SAVE = [parseKeyString('ctrl+n')];
const KEY_DELETE = [parseKeyString('ctrl+x'), parseKeyString('delete')];
const KEY_MOVE_UP = [parseKeyString('ctrl+k')];
const KEY_MOVE_DOWN = [parseKeyString('ctrl+j')];
const KEY_EDIT_FILTER = [parseKeyString('ctrl+e')];

const PICK_HINTS: readonly PickerHint[] = [
  { key: 'Enter', description: 'apply group' },
  { key: 'Ctrl+n', description: 'save current filter' },
  { key: 'Ctrl+x', description: 'delete group' },
  { key: 'C+j/k', description: 'move group' },
  { key: 'Ctrl+e', description: 'edit filter' },
  { key: 'Esc', description: 'close' },
];

const groupToPickerItem = (group: SettingsGroup): PickerItem => ({
  id: group.id,
  label: group.name,
  searchText: group.name,
});

export default function GroupPickerModal({ isVisible, onClose, onEditFilter }: GroupPickerModalProps) {
  const groups = useAtomValue(userGroupsAtom);
  const setUserFilter = useAtomSet(setUserFilterAtom);
  const saveGroup = useAtomSet(saveGroupFromFilterAtom, { mode: 'promiseExit' });
  const deleteGroup = useAtomSet(deleteGroupAtom, { mode: 'promiseExit' });
  const moveGroup = useAtomSet(moveGroupAtom, { mode: 'promiseExit' });

  const [mode, setMode] = useState<Mode>('pick');
  const [groupName, setGroupName] = useState('');
  const [pickerKey, setPickerKey] = useState(0);

  const applyGroup = (item: PickerItem) => {
    setUserFilter({ usernames: [], groupIds: [item.id] });
    onClose();
  };

  const handleExtraKey = (key: ParsedKey, context: { highlightedItem: PickerItem | undefined; query: string; highlightIndex: number; filteredCount: number }): boolean => {
    if (matchesAnyKey(key, KEY_SAVE)) {
      setMode('naming');
      setGroupName('');
      return true;
    }

    if (matchesAnyKey(key, KEY_DELETE)) {
      if (context.highlightedItem) deleteGroup(context.highlightedItem.id);
      return true;
    }

    if (matchesAnyKey(key, KEY_MOVE_UP)) {
      if (context.highlightedItem && context.query === '' && context.highlightIndex > 0) {
        moveGroup({ groupId: context.highlightedItem.id, direction: 'up' });
      }
      return true;
    }

    if (matchesAnyKey(key, KEY_EDIT_FILTER)) {
      onEditFilter();
      return true;
    }

    if (matchesAnyKey(key, KEY_MOVE_DOWN)) {
      if (context.highlightedItem && context.query === '' && context.highlightIndex < context.filteredCount - 1) {
        moveGroup({ groupId: context.highlightedItem.id, direction: 'down' });
      }
      return true;
    }

    return false;
  };

  useKeyboard((key: ParsedKey) => {
    if (!isVisible || mode !== 'naming') return;

    if (key.name === 'escape') {
      setMode('pick');
      setGroupName('');
      setPickerKey(k => k + 1);
    }
  });

  if (!isVisible) return null;

  if (mode === 'naming') {
    return (
      <box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}
      >
        <box
          style={{
            width: 50,
            maxHeight: '70%',
            border: true,
            borderColor: Colors.INFO,
            backgroundColor: Colors.BACKGROUND,
            padding: 1,
            flexDirection: 'column',
          }}
        >
          <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Save Group
          </text>

          <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
            <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>Name:</text>
            <input
              focused={true}
              value={groupName}
              placeholder="group name"
              style={{ width: 35 }}
              backgroundColor={Colors.TRACK}
              textColor={Colors.PRIMARY}
              focusedBackgroundColor={Colors.SELECTED}
              focusedTextColor={Colors.PRIMARY}
              placeholderColor={Colors.SUPPORTING}
              cursorColor={Colors.INFO}
              onInput={(v: string) => setGroupName(v)}
              onSubmit={() => {
                const trimmed = groupName.trim();
                if (trimmed) {
                  saveGroup({ name: trimmed });
                  setMode('pick');
                  setGroupName('');
                  setPickerKey(k => k + 1);
                }
              }}
            />
          </box>
          <box style={{ flexDirection: 'column', marginTop: 1 }}>
            <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Enter</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>save group</text></box>
            <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Esc</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>cancel</text></box>
          </box>
        </box>
      </box>
    );
  }

  return (
    <PickerModal
      key={pickerKey}
      isVisible={true}
      title="Pick Group"
      placeholder="search groups..."
      items={groups.map(groupToPickerItem)}
      hints={PICK_HINTS}
      emptyMessage={groups.length === 0 ? 'No groups yet — Ctrl+n to save current filter' : 'No matches'}
      onSelect={applyGroup}
      onClose={onClose}
      onExtraKey={handleExtraKey}
    />
  );
}
