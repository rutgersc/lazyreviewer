import { TextAttributes } from '@opentui/core';
import type { MergeRequestState } from '../generated/gitlab-sdk';
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
    <box style={{ flexDirection: "row", gap: 1, marginBottom: 1, alignItems: "center" }}>
      {MR_STATES.map((state) => {
        const isSelected = currentState === state.key;
        const tabColor = isSelected
          ? Colors.PRIMARY
          : isActive
            ? Colors.NEUTRAL
            : Colors.SECONDARY;

        return (
          <box
            key={state.key}
            style={{
              backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
              padding: 0.5,
              paddingLeft: 1,
              paddingRight: 1,
              border: isSelected,
              borderColor: isSelected ? Colors.PRIMARY : undefined,
            }}
          >
            <text
              style={{
                fg: tabColor,
                attributes: isSelected ? TextAttributes.BOLD : undefined,
              }}
              wrap={false}
            >
              {`${state.shortcut}:${state.label}`}
            </text>
          </box>
        );
      })}
    </box>
  );
}
