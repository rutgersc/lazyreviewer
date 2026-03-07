import { useKeyboard } from '@opentui/react';
import { TextAttributes, type ParsedKey } from '@opentui/core';
import { Colors } from '../colors';
import type { ActiveModal } from '../ui/navigation-atom';

interface FChooserModalProps {
  isVisible: boolean;
  onChoose: (modal: ActiveModal) => void;
  onClose: () => void;
}

export default function FChooserModal({ isVisible, onChoose, onClose }: FChooserModalProps) {
  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'f':
        onChoose('userFilter');
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
      case 'p':
        onChoose('groupPicker');
        break;
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
          minWidth: 30,
          padding: 1,
        }}
      >
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Filter / Sort
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          f  Filter users
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
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          p  Pick group
        </text>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          Esc  Cancel
        </text>
      </box>
    </box>
  );
}
