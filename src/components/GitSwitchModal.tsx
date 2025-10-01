import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../constants/colors";
import { execSync } from "child_process";

interface GitSwitchModalProps {
  isVisible: boolean;
  branchName: string;
  repoPath: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GitSwitchModal({
  isVisible,
  branchName,
  repoPath,
  onClose,
  onSuccess
}: GitSwitchModalProps) {
  if (!isVisible) return null;

  const handleSwitch = () => {
    if (!repoPath) {
      return;
    }

    try {
      execSync(`git switch ${branchName}`, {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to switch branch:', error);
      onClose();
    }
  };

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'escape':
      case 'n':
        onClose();
        break;
      case 'return':
      case 'y':
        handleSwitch();
        break;
    }
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <box
        style={{
          width: 60,
          border: true,
          borderColor: Colors.SUCCESS,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          flexDirection: "column",
          gap: 1,
        }}
      >
        <text
          style={{
            fg: Colors.PRIMARY,
            attributes: TextAttributes.BOLD,
          }}
          wrap={false}
        >
          Git Switch Branch
        </text>

        {!repoPath ? (
          <>
            <text style={{ fg: Colors.ERROR }} wrap={true}>
              No local repository path configured. Press Ctrl+S to configure settings.
            </text>
            <box style={{ marginTop: 1 }}>
              <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}>
                Press ESC to close
              </text>
            </box>
          </>
        ) : (
          <>
            <text style={{ fg: Colors.NEUTRAL }} wrap={true}>
              Switch to branch: {branchName}
            </text>
            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrap={true}>
              Repository: {repoPath}
            </text>

            <box style={{ marginTop: 1, flexDirection: "column" }}>
              <text style={{ fg: Colors.SUCCESS }}>
                Press Y or Enter to confirm
              </text>
              <text style={{ fg: Colors.ERROR }}>
                Press N or ESC to cancel
              </text>
            </box>
          </>
        )}
      </box>
    </box>
  );
}