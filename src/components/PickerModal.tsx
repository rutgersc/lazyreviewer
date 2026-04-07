import { useState } from 'react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { fuzzyMatch } from '../utils/fuzzy-match';
import { matchesAnyKey } from '../actions/key-matcher';
import { parseKeyString } from '../actions/key-matcher';

export interface PickerItem {
  readonly id: string
  readonly label: string
  readonly searchText: string
  readonly subtitle?: string
  readonly labelColor?: string
}

export interface PickerHint {
  readonly key: string
  readonly description: string
}

export interface PickerKeyContext {
  readonly highlightedItem: PickerItem | undefined
  readonly query: string
  readonly highlightIndex: number
  readonly filteredCount: number
}

interface PickerModalProps {
  readonly title: string
  readonly placeholder: string
  readonly items: readonly PickerItem[]
  readonly hints: readonly PickerHint[]
  readonly borderColor?: string
  readonly emptyMessage?: string
  readonly onSelect: (item: PickerItem) => void
  readonly onClose: () => void
  readonly onExtraKey?: (key: ParsedKey, context: PickerKeyContext) => boolean
}

const KEY_UP = [parseKeyString('up')];
const KEY_DOWN = [parseKeyString('down')];

export default function PickerModal({
  title,
  placeholder,
  items,
  hints,
  borderColor = Colors.INFO,
  emptyMessage = 'No matches',
  onSelect,
  onClose,
  onExtraKey,
}: PickerModalProps) {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = query.length === 0
    ? items
    : items
        .map(item => ({ item, score: fuzzyMatch(query, item.searchText) }))
        .filter((r): r is { item: PickerItem; score: number } => r.score !== null)
        .sort((a, b) => b.score - a.score)
        .map(r => r.item);

  const highlightedItem = filtered[highlightIndex];

  const context: PickerKeyContext = {
    highlightedItem,
    query,
    highlightIndex,
    filteredCount: filtered.length,
  };

  useKeyboard((key: ParsedKey) => {
    if (onExtraKey?.(key, context)) return;

    if (matchesAnyKey(key, KEY_UP)) {
      setHighlightIndex(i => Math.max(0, i - 1));
      return;
    }

    if (matchesAnyKey(key, KEY_DOWN)) {
      setHighlightIndex(i => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (key.name === 'return') {
      const item = filtered[highlightIndex];
      if (item) onSelect(item);
      return;
    }

    if (key.name === 'escape') {
      onClose();
    }
  });

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
          borderColor,
          backgroundColor: Colors.BACKGROUND,
          padding: 1,
          flexDirection: 'column',
        }}
      >
        <text style={{ fg: borderColor, attributes: TextAttributes.BOLD }} wrapMode='none'>
          {title}
        </text>

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>{'>'}</text>
          <input
            focused={true}
            value={query}
            placeholder={placeholder}
            style={{ width: 40 }}
            backgroundColor={Colors.TRACK}
            textColor={Colors.PRIMARY}
            focusedBackgroundColor={Colors.SELECTED}
            focusedTextColor={Colors.PRIMARY}
            placeholderColor={Colors.SUPPORTING}
            cursorColor={Colors.INFO}
            onInput={(v: string) => { setQuery(v); setHighlightIndex(0); }}
            onSubmit={() => {
              const item = filtered[highlightIndex];
              if (item) onSelect(item);
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
                {emptyMessage}
              </text>
            )}
            {filtered.map((item, idx) => {
              const isHighlighted = idx === highlightIndex;
              return (
                <box
                  key={item.id}
                  onMouseOver={() => setHighlightIndex(idx)}
                  onMouseDown={() => onSelect(item)}
                  style={{
                    flexDirection: 'column',
                    backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                    paddingLeft: 1,
                  }}
                >
                  <text
                    style={{
                      fg: isHighlighted ? Colors.SUCCESS : (item.labelColor ?? Colors.PRIMARY),
                      attributes: isHighlighted ? TextAttributes.BOLD : TextAttributes.NONE,
                    }}
                    wrapMode='none'
                  >
                    {isHighlighted ? '> ' : '  '}{item.label}
                  </text>
                  {item.subtitle && (
                    <text style={{ fg: Colors.SUPPORTING, paddingLeft: 4 }} wrapMode='none'>
                      {item.subtitle}
                    </text>
                  )}
                </box>
              );
            })}
          </box>
        </scrollbox>

        <box style={{ flexDirection: 'column', marginTop: 1, flexShrink: 0 }}>
          {hints.map(hint => (
            <box key={hint.key} style={{ flexDirection: 'row' }}>
              <text style={{ fg: Colors.SUPPORTING, width: 8 }} wrapMode='none'>{hint.key}</text>
              <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>{hint.description}</text>
            </box>
          ))}
        </box>
      </box>
    </box>
  );
}
