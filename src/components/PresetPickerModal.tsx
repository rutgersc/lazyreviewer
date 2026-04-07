import { useState } from 'react';
import type { ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from "@effect/atom-react";
import { userGroupsAtom, setUserFilterAtom, saveGroupAtom, updateGroupAtom, deleteGroupAtom, moveGroupAtom } from '../settings/settings-atom';
import { knownAuthorsAtom } from '../mergerequests/mergerequests-atom';
import { matchesAnyKey, parseKeyString } from '../actions/key-matcher';
import PickerModal, { type PickerItem, type PickerHint } from './PickerModal';
import PresetEditorModal from './PresetEditorModal';
import type { SettingsGroup } from '../data/default-users-and-groups';
import type { UserId } from '../userselection/userSelection';

interface PresetPickerModalProps {
  onClose: () => void;
}

type EditorState =
  | { mode: 'pick' }
  | { mode: 'new' }
  | { mode: 'edit'; group: SettingsGroup }

const KEY_NEW = [parseKeyString('ctrl+n')];
const KEY_EDIT = [parseKeyString('ctrl+e')];
const KEY_DELETE = [parseKeyString('ctrl+x'), parseKeyString('delete')];
const KEY_MOVE_UP = [parseKeyString('ctrl+k')];
const KEY_MOVE_DOWN = [parseKeyString('ctrl+j')];

const HINTS: readonly PickerHint[] = [
  { key: 'Enter', description: 'apply filter' },
  { key: 'Ctrl+n', description: 'new preset' },
  { key: 'Ctrl+e', description: 'edit preset' },
  { key: 'Ctrl+x', description: 'delete preset' },
  { key: 'C+j/k', description: 'reorder presets' },
  { key: 'Esc', description: 'close' },
];

const ALL_ITEM: PickerItem = {
  id: 'all',
  label: 'All (no filter)',
  searchText: 'all no filter',
  labelColor: Colors.SUPPORTING,
};

const presetToItem = (group: SettingsGroup): PickerItem => ({
  id: `preset:${group.id}`,
  label: `@ ${group.name}`,
  searchText: group.name,
  labelColor: Colors.NEUTRAL,
});

const userToItem = (user: UserId): PickerItem => ({
  id: `user:${user.userId}`,
  label: user.userId,
  searchText: user.userId,
  labelColor: Colors.INFO,
});

const isPresetItem = (item: PickerItem) => item.id.startsWith('preset:');
const presetIdFrom = (item: PickerItem) => item.id.slice('preset:'.length);

export default function PresetPickerModal({ onClose }: PresetPickerModalProps) {
  const groups = useAtomValue(userGroupsAtom);
  const knownAuthors = useAtomValue(knownAuthorsAtom);
  const setUserFilter = useAtomSet(setUserFilterAtom);
  const saveGroup = useAtomSet(saveGroupAtom, { mode: 'promiseExit' });
  const updateGroup = useAtomSet(updateGroupAtom, { mode: 'promiseExit' });
  const deleteGroup = useAtomSet(deleteGroupAtom, { mode: 'promiseExit' });
  const moveGroup = useAtomSet(moveGroupAtom, { mode: 'promiseExit' });

  const [editorState, setEditorState] = useState<EditorState>({ mode: 'pick' });
  const [pickerKey, setPickerKey] = useState(0);

  const items: readonly PickerItem[] = [
    ALL_ITEM,
    ...groups.map(presetToItem),
    ...knownAuthors.map(userToItem),
  ];

  const handleSelect = (item: PickerItem) => {
    if (item.id === 'all') {
      setUserFilter({ usernames: [], groupIds: [] });
    } else if (item.id.startsWith('preset:')) {
      setUserFilter({ usernames: [], groupIds: [presetIdFrom(item)] });
    } else if (item.id.startsWith('user:')) {
      const username = item.id.slice('user:'.length);
      setUserFilter({ usernames: [username], groupIds: [] });
    }
    onClose();
  };

  const handleExtraKey = (key: ParsedKey, context: { highlightedItem: PickerItem | undefined; query: string; highlightIndex: number; filteredCount: number }): boolean => {
    if (matchesAnyKey(key, KEY_NEW)) {
      setEditorState({ mode: 'new' });
      return true;
    }

    if (matchesAnyKey(key, KEY_EDIT)) {
      const item = context.highlightedItem;
      if (item && isPresetItem(item)) {
        const group = groups.find(g => g.id === presetIdFrom(item));
        if (group) setEditorState({ mode: 'edit', group });
      }
      return true;
    }

    if (matchesAnyKey(key, KEY_DELETE)) {
      const item = context.highlightedItem;
      if (item && isPresetItem(item)) {
        deleteGroup(presetIdFrom(item));
      }
      return true;
    }

    if (matchesAnyKey(key, KEY_MOVE_UP)) {
      const item = context.highlightedItem;
      if (item && isPresetItem(item) && context.query === '' && context.highlightIndex > 1) {
        moveGroup({ groupId: presetIdFrom(item), direction: 'up' });
      }
      return true;
    }

    if (matchesAnyKey(key, KEY_MOVE_DOWN)) {
      const item = context.highlightedItem;
      if (item && isPresetItem(item) && context.query === '' && context.highlightIndex < groups.length) {
        moveGroup({ groupId: presetIdFrom(item), direction: 'down' });
      }
      return true;
    }

    return false;
  };

  const handleEditorSave = (name: string, userIds: readonly string[], groupIds: readonly string[]) => {
    if (editorState.mode === 'new') {
      saveGroup({ name, users: [...userIds], groups: [...groupIds] });
    } else if (editorState.mode === 'edit') {
      updateGroup({ id: editorState.group.id, name, users: [...userIds], groups: [...groupIds] });
    }
    setEditorState({ mode: 'pick' });
    setPickerKey(k => k + 1);
  };

  const handleEditorClose = () => {
    setEditorState({ mode: 'pick' });
    setPickerKey(k => k + 1);
  };

  if (editorState.mode !== 'pick') {
    const editing = editorState.mode === 'edit' ? editorState.group : undefined;
    return (
      <PresetEditorModal
        {...(editing && { initialName: editing.name, initialUserIds: editing.users, initialGroupIds: editing.groups })}
        onSave={handleEditorSave}
        onClose={handleEditorClose}
      />
    );
  }

  return (
    <PickerModal
      key={pickerKey}
      title="Users & Presets"
      placeholder="search..."
      items={items}
      hints={HINTS}
      emptyMessage="No matches"
      onSelect={handleSelect}
      onClose={onClose}
      onExtraKey={handleExtraKey}
    />
  );
}
