import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue } from '@effect-atom/atom-react';
import { knownAuthorsAtom } from '../mergerequests/mergerequests-atom';
import { userFilterUsernamesAtom, userFilterGroupIdsAtom } from '../settings/settings-atom';
import { groupsAtom } from '../data/data-atom';
import { resolveGroupIds } from '../userselection/userSelection';
import type { UserId, UserGroup } from '../userselection/userSelection';

type Column = 'left' | 'right'

interface UserFilterModalProps {
  isVisible: boolean;
  onConfirm: (usernames: readonly string[], groupIds: readonly string[]) => void;
  onClose: () => void;
}

export default function UserFilterModal({ isVisible, onConfirm, onClose }: UserFilterModalProps) {
  const knownAuthors = useAtomValue(knownAuthorsAtom);
  const currentUsernames = useAtomValue(userFilterUsernamesAtom);
  const currentGroupIds = useAtomValue(userFilterGroupIdsAtom);
  const groups = useAtomValue(groupsAtom);

  const [activeColumn, setActiveColumn] = React.useState<Column>('left');
  const [leftIndex, setLeftIndex] = React.useState(0);
  const [rightIndex, setRightIndex] = React.useState(0);
  const [checkedUsernames, setCheckedUsernames] = React.useState<ReadonlySet<string>>(new Set());
  const [checkedGroupIds, setCheckedGroupIds] = React.useState<ReadonlySet<string>>(new Set());

  const leftItems: readonly ('all' | UserGroup)[] = React.useMemo(() => [
    'all' as const,
    ...groups,
  ], [groups]);

  const rightItems: readonly UserId[] = knownAuthors;

  const groupMemberUserIds = React.useMemo(() => {
    const resolved = resolveGroupIds([...checkedGroupIds], groups);
    return new Set(resolved.map(u => u.userId));
  }, [checkedGroupIds, groups]);

  React.useEffect(() => {
    if (isVisible) {
      setCheckedUsernames(new Set(currentUsernames));
      setCheckedGroupIds(new Set(currentGroupIds));
      setActiveColumn('left');
      setLeftIndex(0);
      setRightIndex(0);
    }
  }, [isVisible, currentUsernames, currentGroupIds]);

  const toggleLeftItem = React.useCallback((item: 'all' | UserGroup) => {
    if (item === 'all') {
      setCheckedUsernames(new Set());
      setCheckedGroupIds(new Set());
    } else {
      const id = item.id.id;
      setCheckedGroupIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, []);

  const toggleRightItem = React.useCallback((author: UserId) => {
    const name = author.userId;
    setCheckedUsernames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    onConfirm([...checkedUsernames], [...checkedGroupIds]);
  }, [onConfirm, checkedUsernames, checkedGroupIds]);

  const handleCancel = React.useCallback(() => {
    onClose();
  }, [onClose]);

  const toggleCurrentItem = React.useCallback(() => {
    if (activeColumn === 'left') {
      const item = leftItems[leftIndex];
      if (item) toggleLeftItem(item);
    } else {
      const item = rightItems[rightIndex];
      if (item) toggleRightItem(item);
    }
  }, [activeColumn, leftIndex, rightIndex, leftItems, rightItems, toggleLeftItem, toggleRightItem]);

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

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
        handleConfirm();
        break;
      case 'c':
      case 'escape':
        handleCancel();
        break;
    }
  });

  if (!isVisible) return null;

  const isAllChecked = checkedUsernames.size === 0 && checkedGroupIds.size === 0;
  const totalSelected = checkedUsernames.size + checkedGroupIds.size;
  const hasGroups = groups.length > 0;
  const hasUsers = knownAuthors.length > 0;

  const getUserColor = (author: UserId): string => {
    const isIndividual = checkedUsernames.has(author.userId);
    const isGroupMember = groupMemberUserIds.has(author.userId);
    if (isIndividual && isGroupMember) return Colors.WARNING;
    if (isIndividual) return Colors.INFO;
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
        <box>
          <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Filter by user {isAllChecked ? '(all)' : `(${totalSelected} selected)`}
          </text>
        </box>
        <box>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            h/l columns  j/k navigate  Space toggle
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
            {/* Left column: All + Groups */}
            <box style={{ flexDirection: "column", minWidth: 25 }}>
              <text style={{ fg: Colors.SUPPORTING, attributes: TextAttributes.DIM }} wrapMode='none'>
                Groups
              </text>
              {leftItems.map((item, idx) => {
                const isAll = item === 'all';
                const isHighlighted = activeColumn === 'left' && idx === leftIndex;
                const isChecked = isAll ? isAllChecked : checkedGroupIds.has(item.id.id);
                const checkbox = isChecked ? '[x]' : '[ ]';
                const label = isAll ? 'All (no filter)' : item.name;
                const color = isAll
                  ? (isAllChecked ? Colors.INFO : Colors.PRIMARY)
                  : (isChecked ? Colors.NEUTRAL : Colors.PRIMARY);

                return (
                  <box
                    key={isAll ? '__all__' : `group-${item.id.id}`}
                    onMouseDown={() => {
                      setActiveColumn('left');
                      setLeftIndex(idx);
                      if (isAll) toggleLeftItem('all');
                      else toggleLeftItem(item);
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
                      {`${checkbox} ${label}`}
                    </text>
                  </box>
                );
              })}
            </box>

            {/* Right column: Users */}
            <box style={{ flexDirection: "column", minWidth: 25 }}>
              {hasUsers && (
                <text style={{ fg: Colors.SUPPORTING, attributes: TextAttributes.DIM }} wrapMode='none'>
                  Users
                </text>
              )}
              {rightItems.map((author, idx) => {
                const isHighlighted = activeColumn === 'right' && idx === rightIndex;
                const isChecked = checkedUsernames.has(author.userId);
                const checkbox = isChecked ? '[x]' : '[ ]';
                const color = getUserColor(author);

                return (
                  <box
                    key={`user-${author.userId}`}
                    onMouseDown={() => {
                      setActiveColumn('right');
                      setRightIndex(idx);
                      toggleRightItem(author);
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

        {!hasGroups && !hasUsers && (
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
            No authors known yet - fetch some MRs first
          </text>
        )}

        <box style={{ flexDirection: "row", gap: 2, marginTop: 1, justifyContent: "flex-end" }}>
          <text onMouseDown={handleConfirm} style={{ fg: Colors.SUCCESS }}>
            [o]k
          </text>
          <text onMouseDown={handleCancel} style={{ fg: Colors.ERROR }}>
            [c]ancel
          </text>
        </box>
      </box>
    </box>
  );
}
