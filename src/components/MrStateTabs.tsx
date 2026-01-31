import { TextAttributes } from '@opentui/core';
import type { MergeRequestState } from '../domain/merge-request-state';
import { Colors } from '../colors';

interface MrStateTabsProps {
  currentState: MergeRequestState;
  onStateChange: (state: MergeRequestState) => void;
  isActive: boolean;
}

const MR_STATES: Array<{ key: MergeRequestState; label: string; shortcut: string }> = [
  { key: 'opened', label: 'Open', shortcut: '1' },
  { key: 'merged', label: 'Merged', shortcut: '2' },
  { key: 'closed', label: 'Closed', shortcut: '3' },
  { key: 'locked', label: 'Draft', shortcut: '4' },
  { key: 'all', label: 'All', shortcut: '5' },
];

export default function MrStateTabs({ currentState, onStateChange, isActive }: MrStateTabsProps) {
  return (
    <box style={{ flexDirection: "column", gap: 0, marginBottom: 1 }}>
      <box style={{ flexDirection: "row", gap: 1 }}>
        {MR_STATES.map((state, index) => {
          const isSelected = currentState === state.key;
          const tabColor = isSelected
            ? Colors.PRIMARY
            : Colors.NEUTRAL;

          return (
            <text
              key={state.key}
              onMouseDown={() => onStateChange(state.key)}
              style={{
                fg: tabColor,
                attributes: isSelected ? TextAttributes.BOLD : undefined,
              }}
              wrapMode='none'
            >
              {index > 0 ? '| ' : ''}{`${state.shortcut}:${state.label}`}
            </text>
          );
        })}
      </box>
    </box>
  );
}
