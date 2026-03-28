import { TextAttributes } from '@opentui/core';
import type { MergeRequestState } from '../domain/merge-request-state';
import { Colors } from '../colors';

interface MrStateTabsProps {
  currentState: MergeRequestState;
  onStateChange: (state: MergeRequestState) => void;
  isActive: boolean;
}

const MR_STATES: Array<{ key: MergeRequestState; label: string }> = [
  { key: 'opened', label: 'Open' },
  { key: 'merged', label: 'Merged' },
  { key: 'closed', label: 'Closed' },
  { key: 'locked', label: 'Draft' },
  { key: 'all', label: 'All' },
];

export default function MrStateTabs({ currentState, onStateChange, isActive }: MrStateTabsProps) {
  return (
    <box style={{ minHeight: 1, maxHeight: 1, overflow: "hidden" }}>
      <box style={{ flexDirection: "row", columnGap: 1, rowGap: 0 }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          State:
        </text>
        {MR_STATES.map(state => {
          const isSelected = currentState === state.key;
          return (
            <box
              key={state.key}
              onMouseDown={() => onStateChange(state.key)}
              style={{
                ...(isSelected && { backgroundColor: Colors.TRACK }),
                paddingLeft: 1,
                paddingRight: 1,
              }}
            >
              <text
                style={{
                  fg: isSelected ? Colors.INFO : Colors.NEUTRAL,
                  attributes: isSelected ? TextAttributes.BOLD : TextAttributes.DIM,
                }}
                wrapMode='none'
              >
                {state.label}
              </text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
