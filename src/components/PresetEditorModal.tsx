import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue } from '@effect-atom/atom-react';
import { knownAuthorsAtom } from '../mergerequests/mergerequests-atom';
import { groupsAtom } from '../data/data-atom';
import { resolveGroupIds } from '../userselection/userSelection';
import type { UserId, UserGroup } from '../userselection/userSelection';

type Column = 'left' | 'right'

interface PresetEditorModalProps {
  isVisible: boolean;
  initialName?: string;
  initialUserIds?: readonly string[];
  initialGroupIds?: readonly string[];
  onSave: (name: string, userIds: readonly string[], groupIds: readonly string[]) => void;
  onClose: () => void;
}

export default function PresetEditorModal({ isVisible, initialName, initialUserIds, initialGroupIds, onSave, onClose }: PresetEditorModalProps) {
  const knownAuthors = useAtomValue(knownAuthorsAtom);
  const groups = useAtomValue(groupsAtom);

  const [name, setName] = React.useState('');
  const [nameInputFocused, setNameInputFocused] = React.useState(false);
  const [activeColumn, setActiveColumn] = React.useState<Column>('left');
  const [leftIndex, setLeftIndex] = React.useState(0);
  const [rightIndex, setRightIndex] = React.useState(0);
  const [checkedUserIds, setCheckedUserIds] = React.useState<ReadonlySet<string>>(new Set());
  const [checkedGroupIds, setCheckedGroupIds] = React.useState<ReadonlySet<string>>(new Set());

  const leftItems: readonly UserGroup[] = groups;
  const rightItems: readonly UserId[] = knownAuthors;

  const groupMemberUserIds = React.useMemo(() => {
    const resolved = resolveGroupIds([...checkedGroupIds], groups);
    return new Set(resolved.map(u => u.userId));
  }, [checkedGroupIds, groups]);

  const highlightedGroupMemberIds = React.useMemo(() => {
    if (activeColumn !== 'left') return new Set<string>();
    const item = leftItems[leftIndex];
    if (!item) return new Set<string>();
    const resolved = resolveGroupIds([item.id.id], groups);
    return new Set(resolved.map(u => u.userId));
  }, [activeColumn, leftIndex, leftItems, groups]);

  React.useEffect(() => {
    if (isVisible) {
      setName(initialName ?? '');
      setNameInputFocused(!initialName);
      setCheckedUserIds(new Set(initialUserIds ?? []));
      setCheckedGroupIds(new Set(initialGroupIds ?? []));
      setActiveColumn('left');
      setLeftIndex(0);
      setRightIndex(0);
    }
  }, [isVisible]);

  const toggleGroup = React.useCallback((group: UserGroup) => {
    const id = group.id.id;
    setCheckedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleUser = React.useCallback((author: UserId) => {
    const id = author.userId;
    setCheckedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = React.useCallback(() => {
    const trimmed = name.trim();
    if (trimmed) {
      onSave(trimmed, [...checkedUserIds], [...checkedGroupIds]);
    }
  }, [onSave, name, checkedUserIds, checkedGroupIds]);

  const toggleCurrentItem = React.useCallback(() => {
    if (activeColumn === 'left') {
      const item = leftItems[leftIndex];
      if (item) toggleGroup(item);
    } else {
      const item = rightItems[rightIndex];
      if (item) toggleUser(item);
    }
  }, [activeColumn, leftIndex, rightIndex, leftItems, rightItems, toggleGroup, toggleUser]);

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    if (nameInputFocused) {
      if (key.name === 'escape') {
        onClose();
      }
      return;
    }

    switch (key.name) {
      case 'h':
      case 'left':
        setActiveColumn('left');
        break;
      case 'l':
      case 'right':
        setActiveColumn('right');
        break;
      case 'j':
      case 'down':
        if (activeColumn === 'left') {
          setLeftIndex(prev => Math.min(prev + 1, leftItems.length - 1));
        } else {
          setRightIndex(prev => Math.min(prev + 1, rightItems.length - 1));
        }
        break;
      case 'k':
      case 'up':
        if (activeColumn === 'left') {
          setLeftIndex(prev => Math.max(prev - 1, 0));
        } else {
          setRightIndex(prev => Math.max(prev - 1, 0));
        }
        break;
      case 'space':
        toggleCurrentItem();
        break;
      case 'o':
      case 'return':
        handleSave();
        break;
      case 'escape':
        onClose();
        break;
    }
  });

  if (!isVisible) return null;

  const isEditing = !!initialName;
  const totalSelected = checkedUserIds.size + checkedGroupIds.size;

  const getUserColor = (author: UserId): string => {
    const isIndividual = checkedUserIds.has(author.userId);
    const isGroupMember = groupMemberUserIds.has(author.userId);
    const isHighlightedMember = highlightedGroupMemberIds.has(author.userId);
    if (isIndividual && isGroupMember) return Colors.WARNING;
    if (isIndividual) return Colors.INFO;
    if (isHighlightedMember) return Colors.ACCENT;
    if (isGroupMember) return Colors.SECONDARY;
    return Colors.PRIMARY;
  };

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
        alignItems: "center",
      }}
    >
      <box
        style={{
          border: true,
          borderColor: Colors.SUCCESS,
          backgroundColor: Colors.BACKGROUND,
          flexDirection: "column",
          minWidth: 60,
          maxHeight: "80%",
          padding: 1,
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          {isEditing ? 'Edit Preset' : 'New Preset'} ({totalSelected} selected)
        </text>

        <box style={{ flexDirection: 'row', gap: 1, marginTop: 1 }}>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>Name:</text>
          <input
            focused={nameInputFocused}
            value={name}
            placeholder="preset name"
            style={{ width: 35 }}
            backgroundColor={Colors.TRACK}
            textColor={Colors.PRIMARY}
            focusedBackgroundColor={Colors.SELECTED}
            focusedTextColor={Colors.PRIMARY}
            placeholderColor={Colors.SUPPORTING}
            cursorColor={Colors.INFO}
            onInput={(v: string) => setName(v)}
            onSubmit={() => setNameInputFocused(false)}
          />
        </box>

        <box>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            {nameInputFocused ? 'Enter to continue  Esc cancel' : 'h/l columns  j/k navigate  Space toggle'}
          </text>
        </box>

        <scrollbox style={{
          flexGrow: 1,
          contentOptions: { backgroundColor: Colors.BACKGROUND },
          scrollbarOptions: {
            width: 1,
            trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK }
          }
        }}>
          <box style={{ flexDirection: "row" }}>
            {/* Left column: Groups */}
            <box style={{ flexDirection: "column", minWidth: 25 }}>
              <text style={{ fg: Colors.SUPPORTING, attributes: TextAttributes.DIM }} wrapMode='none'>
                Presets
              </text>
              {leftItems.map((group, idx) => {
                const isHighlighted = !nameInputFocused && activeColumn === 'left' && idx === leftIndex;
                const isChecked = checkedGroupIds.has(group.id.id);
                const checkbox = isChecked ? '[x]' : '[ ]';

                return (
                  <box
                    key={`group-${group.id.id}`}
                    onMouseOver={() => {
                      setActiveColumn('left');
                      setLeftIndex(idx);
                    }}
                    onMouseDown={() => {
                      setNameInputFocused(false);
                      setActiveColumn('left');
                      setLeftIndex(idx);
                      toggleGroup(group);
                    }}
                    style={{ backgroundColor: isHighlighted ? Colors.TRACK : undefined }}
                  >
                    <text
                      style={{
                        fg: isChecked ? Colors.NEUTRAL : Colors.PRIMARY,
                        attributes: isHighlighted ? TextAttributes.BOLD : undefined,
                      }}
                      wrapMode='none'
                    >
                      {`${checkbox} ${group.name}`}
                    </text>
                  </box>
                );
              })}
            </box>

            {/* Right column: Users */}
            <box style={{ flexDirection: "column", minWidth: 25 }}>
              {knownAuthors.length > 0 && (
                <text style={{ fg: Colors.SUPPORTING, attributes: TextAttributes.DIM }} wrapMode='none'>
                  Users
                </text>
              )}
              {rightItems.map((author, idx) => {
                const isHighlighted = !nameInputFocused && activeColumn === 'right' && idx === rightIndex;
                const isChecked = checkedUserIds.has(author.userId);
                const checkbox = isChecked ? '[x]' : '[ ]';
                const color = getUserColor(author);

                return (
                  <box
                    key={`user-${author.userId}`}
                    onMouseOver={() => {
                      setActiveColumn('right');
                      setRightIndex(idx);
                    }}
                    onMouseDown={() => {
                      setNameInputFocused(false);
                      setActiveColumn('right');
                      setRightIndex(idx);
                      toggleUser(author);
                    }}
                    style={{ backgroundColor: isHighlighted ? Colors.TRACK : undefined }}
                  >
                    <text
                      style={{
                        fg: color,
                        attributes: isHighlighted ? TextAttributes.BOLD : undefined,
                      }}
                      wrapMode='none'
                    >
                      {`${checkbox} ${author.userId}`}
                    </text>
                  </box>
                );
              })}
            </box>
          </box>
        </scrollbox>

        <box style={{ flexDirection: "row", gap: 2, marginTop: 1, justifyContent: "flex-end" }}>
          <text onMouseDown={handleSave} style={{ fg: Colors.SUCCESS }}>
            [o] save
          </text>
          <text onMouseDown={onClose} style={{ fg: Colors.ERROR }}>
            [Esc] cancel
          </text>
        </box>
      </box>
    </box>
  );
}
