import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import type { ActiveModal } from '../ui/navigation-atom';

interface FChooserModalProps {
  onChoose: (modal: ActiveModal) => void;
  onClose: () => void;
}

export default function FChooserModal({ onChoose, onClose }: FChooserModalProps) {
  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'f':
        onChoose('presetPicker');
        break;
      case 's':
        onChoose('mrSort');
        break;
      case 't':
        onChoose('mrState');
        break;
      case 'r':
        onChoose('repoFilter');
        break;
      case 'escape':
        onClose();
        break;
    }
  });

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
          minWidth: 30,
          padding: 1,
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Filter / Sort
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          f  Users & Presets
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          s  Sort MRs
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          t  MR state
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          r  Repositories
        </text>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          Esc  Cancel
        </text>
      </box>
    </box>
  );
}
