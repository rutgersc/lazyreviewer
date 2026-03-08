import { useState } from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { userGroupsAtom, setUserFilterAtom, saveGroupFromFilterAtom, deleteGroupAtom, moveGroupAtom } from '../settings/settings-atom';
import { fuzzyMatch } from '../utils/fuzzy-match';
import { matchesAnyKey, parseKeyString } from '../actions/key-matcher';
import type { SettingsGroup } from '../data/default-users-and-groups';

type Mode = 'pick' | 'naming'

interface GroupPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const KEY_SAVE = [parseKeyString('ctrl+n')];
const KEY_DELETE = [parseKeyString('ctrl+x'), parseKeyString('delete')];
const KEY_MOVE_UP = [parseKeyString('ctrl+k')];
const KEY_MOVE_DOWN = [parseKeyString('ctrl+j')];
const KEY_UP = [parseKeyString('up')];
const KEY_DOWN = [parseKeyString('down')];

export default function GroupPickerModal({ isVisible, onClose }: GroupPickerModalProps) {
  const groups = useAtomValue(userGroupsAtom);
  const setUserFilter = useAtomSet(setUserFilterAtom);
  const saveGroup = useAtomSet(saveGroupFromFilterAtom, { mode: 'promiseExit' });
  const deleteGroup = useAtomSet(deleteGroupAtom, { mode: 'promiseExit' });
  const moveGroup = useAtomSet(moveGroupAtom, { mode: 'promiseExit' });

  const [mode, setMode] = useState<Mode>('pick');
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = query.length === 0
    ? groups
    : groups
        .map(g => ({ group: g, score: fuzzyMatch(query, g.name) }))
        .filter((r): r is { group: SettingsGroup; score: number } => r.score !== null)
        .sort((a, b) => b.score - a.score)
        .map(r => r.group);

  const applyGroup = (group: SettingsGroup) => {
    setUserFilter({ usernames: [], groupIds: [group.id] });
    onClose();
  };

  const handleDeleteHighlighted = () => {
    const group = filtered[highlightIndex];
    if (group) deleteGroup(group.id);
  };

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    if (mode === 'naming') {
      if (key.name === 'escape') {
        setMode('pick');
        setGroupName('');
      }
      return;
    }

    if (matchesAnyKey(key, KEY_SAVE)) {
      setMode('naming');
      setGroupName('');
      return;
    }

    if (matchesAnyKey(key, KEY_DELETE)) {
      handleDeleteHighlighted();
      return;
    }

    if (matchesAnyKey(key, KEY_MOVE_UP)) {
      const group = filtered[highlightIndex];
      if (group && query.length === 0 && highlightIndex > 0) {
        moveGroup({ groupId: group.id, direction: 'up' });
        setHighlightIndex(i => i - 1);
      }
      return;
    }

    if (matchesAnyKey(key, KEY_MOVE_DOWN)) {
      const group = filtered[highlightIndex];
      if (group && query.length === 0 && highlightIndex < filtered.length - 1) {
        moveGroup({ groupId: group.id, direction: 'down' });
        setHighlightIndex(i => i + 1);
      }
      return;
    }

    if (matchesAnyKey(key, KEY_UP)) {
      setHighlightIndex(i => Math.max(0, i - 1));
      return;
    }

    if (matchesAnyKey(key, KEY_DOWN)) {
      setHighlightIndex(i => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (key.name === 'return') {
      const group = filtered[highlightIndex];
      if (group) applyGroup(group);
      return;
    }

    if (key.name === 'escape') {
      onClose();
    }
  });

  if (!isVisible) return null;

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
          {mode === 'naming' ? 'Save Group' : 'Pick Group'}
        </text>

        {mode === 'pick' && (
          <>
            <box style={{ flexDirection: 'row', gap: 1 }}>
              <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>{'>'}</text>
              <input
                focused={true}
                value={query}
                placeholder="search groups..."
                style={{ width: 40 }}
                backgroundColor={Colors.TRACK}
                textColor={Colors.PRIMARY}
                focusedBackgroundColor={Colors.SELECTED}
                focusedTextColor={Colors.PRIMARY}
                placeholderColor={Colors.SUPPORTING}
                cursorColor={Colors.INFO}
                onInput={(v: string) => { setQuery(v); setHighlightIndex(0); }}
                onSubmit={() => {
                  const group = filtered[highlightIndex];
                  if (group) applyGroup(group);
                }}
              />
            </box>

            <scrollbox
              style={{
                flexGrow: 1,
                contentOptions: { backgroundColor: Colors.BACKGROUND },
                scrollbarOptions: {
                  width: 1,
                  trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
                },
              }}
            >
              <box style={{ flexDirection: 'column' }}>
                {filtered.length === 0 && (
                  <text style={{ fg: Colors.SUPPORTING, paddingLeft: 1 }} wrapMode='none'>
                    {groups.length === 0 ? 'No groups yet — Ctrl+n to save current filter' : 'No matches'}
                  </text>
                )}
                {filtered.map((group, idx) => {
                  const isHighlighted = idx === highlightIndex;
                  const summary = [
                    ...group.groups,
                    ...group.users,
                  ].join(', ') || '(empty)';

                  return (
                    <box
                      key={group.id}
                      onMouseDown={() => {
                        if (idx === highlightIndex) applyGroup(group);
                        else setHighlightIndex(idx);
                      }}
                      style={{
                        flexDirection: 'column',
                        backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                        paddingLeft: 1,
                      }}
                    >
                      <text
                        style={{
                          fg: isHighlighted ? Colors.SUCCESS : Colors.PRIMARY,
                          attributes: isHighlighted ? TextAttributes.BOLD : TextAttributes.NONE,
                        }}
                        wrapMode='none'
                      >
                        {isHighlighted ? '> ' : '  '}{group.name}
                      </text>
                      <text style={{ fg: Colors.SUPPORTING, paddingLeft: 4 }} wrapMode='none'>
                        {summary}
                      </text>
                    </box>
                  );
                })}
              </box>
            </scrollbox>

            <box style={{ flexDirection: 'column', marginTop: 1, flexShrink: 0 }}>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Enter</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>apply group</text></box>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Ctrl+n</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>save current filter</text></box>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Ctrl+x</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>delete group</text></box>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>C+j/k</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>move group</text></box>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Esc</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>close</text></box>
            </box>
          </>
        )}

        {mode === 'naming' && (
          <>
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
                    setQuery('');
                  }
                }}
              />
            </box>
            <box style={{ flexDirection: 'column', marginTop: 1 }}>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Enter</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>save group</text></box>
              <box style={{ flexDirection: 'row' }}><text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>Esc</text><text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>cancel</text></box>
            </box>
          </>
        )}
      </box>
    </box>
  );
}
