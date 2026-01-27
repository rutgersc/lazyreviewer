import { TextAttributes } from '@opentui/core';
import { Colors } from '../../colors';

interface EpicLegendProps {
  epicColors: Map<string, string>;
  onClose: () => void;
}

export default function EpicLegend({ epicColors, onClose }: EpicLegendProps) {
  const entries = Array.from(epicColors.entries());

  return (
    <box
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: Colors.BACKGROUND,
        borderStyle: 'single',
        borderColor: Colors.NEUTRAL,
        padding: 1,
        flexDirection: 'column',
        zIndex: 1001,
      }}
    >
      <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode="none">
        Epic Colors
      </text>
      <text style={{ fg: Colors.SUPPORTING }} wrapMode="none">
        (e to close)
      </text>
      <box style={{ height: 1 }} />
      {entries.map(([key, color]) => (
        <box key={key} style={{ flexDirection: 'row', gap: 1 }}>
          <box style={{ width: 2, backgroundColor: color }} />
          <text style={{ fg: Colors.PRIMARY }} wrapMode="none">
            {key}
          </text>
        </box>
      ))}
    </box>
  );
}
