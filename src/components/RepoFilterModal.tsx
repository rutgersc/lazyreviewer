import React from 'react';
import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import { useAtomValue } from "@effect/atom-react";
import { knownProjectsAtom } from '../mergerequests/mergerequests-atom';
import { repositoryFullPath } from '../userselection/userSelection';

interface RepoFilterModalProps {
  isVisible: boolean;
  currentFilter: readonly string[];
  onConfirm: (filter: readonly string[]) => void;
  onClose: () => void;
}

const shortName = (path: string) => {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
};

export default function RepoFilterModal({ isVisible, currentFilter, onConfirm, onClose }: RepoFilterModalProps) {
  const knownProjects = useAtomValue(knownProjectsAtom);
  const allPaths = React.useMemo(() => knownProjects.map(repositoryFullPath), [knownProjects]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [checked, setChecked] = React.useState<ReadonlySet<string>>(new Set());

  // items: "all" sentinel + each repo path
  const items = React.useMemo(() => ['__all__' as const, ...allPaths], [allPaths]);

  React.useEffect(() => {
    if (isVisible) {
      setChecked(new Set(currentFilter));
      setSelectedIndex(0);
    }
  }, [isVisible, currentFilter]);

  const isAllSelected = checked.size === 0;

  const toggle = React.useCallback((index: number) => {
    const item = items[index];
    if (!item) return;

    if (item === '__all__') {
      setChecked(new Set());
    } else {
      setChecked(prev => {
        const wasAll = prev.size === 0;
        if (wasAll) {
          // switching from "all" to specific: enable all except the toggled one
          return new Set(allPaths.filter(p => p !== item));
        }
        const next = new Set(prev);
        if (next.has(item)) {
          next.delete(item);
          // if nothing left, go back to "all"
          return next.size === 0 ? new Set<string>() : next;
        }
        next.add(item);
        return next;
      });
    }
  }, [items, allPaths]);

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'space':
        toggle(selectedIndex);
        break;
      case 'o':
      case 'return':
        onConfirm([...checked]);
        break;
      case 'c':
      case 'escape':
        onClose();
        break;
    }
  });

  if (!isVisible) return null;

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
          minWidth: 40,
          padding: 1,
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Filter by repository {isAllSelected ? '(all)' : `(${checked.size} selected)`}
        </text>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          j/k navigate  Space toggle
        </text>

        {items.map((item, index) => {
          const isAll = item === '__all__';
          const isHighlighted = index === selectedIndex;
          const isChecked = isAll ? isAllSelected : checked.has(item);
          const checkbox = isChecked ? '[x]' : '[ ]';
          const label = isAll ? 'All (no filter)' : shortName(item);
          const color = isAll
            ? (isAllSelected ? Colors.INFO : Colors.PRIMARY)
            : (isChecked ? Colors.INFO : Colors.PRIMARY);

          return (
            <box
              key={item}
              onMouseDown={() => { setSelectedIndex(index); toggle(index); }}
              style={{ ...(isHighlighted && { backgroundColor: Colors.TRACK }) }}
            >
              <text
                style={{
                  fg: color,
                  ...(isHighlighted && { attributes: TextAttributes.BOLD }),
                }}
                wrapMode='none'
              >
                {`${checkbox} ${label}`}
              </text>
            </box>
          );
        })}

        <box style={{ flexDirection: "row", gap: 2, marginTop: 1, justifyContent: "flex-end" }}>
          <text onMouseDown={() => onConfirm([...checked])} style={{ fg: Colors.SUCCESS }}>
            [o]k
          </text>
          <text onMouseDown={onClose} style={{ fg: Colors.ERROR }}>
            [c]ancel
          </text>
        </box>
      </box>
    </box>
  );
}
