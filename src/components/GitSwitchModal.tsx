import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { execSync } from "child_process";
import { useState, useEffect } from "react";
import { getWorkingTreeStatus, type GitWorkingTreeStatus } from "../git/git-effects";

interface GitSwitchModalProps {
  isVisible: boolean;
  branchName: string;
  repoPath: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const initialStatus: GitWorkingTreeStatus = {
  currentBranch: null,
  stagedCount: 0,
  unstagedCount: 0,
  unpushedCommits: []
};

export default function GitSwitchModal({
  isVisible,
  branchName,
  repoPath,
  onClose,
  onSuccess,
  onError
}: GitSwitchModalProps) {
  const [status, setStatus] = useState<GitWorkingTreeStatus>(initialStatus);

  useEffect(() => {
    if (isVisible && repoPath) {
      setStatus(getWorkingTreeStatus(repoPath));
    } else {
      setStatus(initialStatus);
    }
  }, [isVisible, repoPath]);

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    const handleSwitch = () => {
      if (!repoPath) return;

      try {
        execSync(`git switch ${branchName}`, {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        onSuccess();
        onClose();
      } catch (error) {
        const errorMessage = error instanceof Error
          ? (error as { stderr?: string }).stderr || error.message
          : 'Unknown error';
        onError(`Failed to switch branch: ${errorMessage}`);
        onClose();
      }
    };

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

  if (!isVisible) return null;

  const hasUncommittedChanges = status.stagedCount > 0 || status.unstagedCount > 0;
  const hasUnpushedCommits = status.unpushedCommits.length > 0;
  const hasWarnings = hasUncommittedChanges || hasUnpushedCommits;

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
          width: 90,
          border: true,
          borderColor: hasWarnings ? Colors.WARNING : Colors.SUCCESS,
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
          wrapMode='none'
        >
          Git Switch Branch
        </text>

        {!repoPath ? (
          <>
            <text style={{ fg: Colors.ERROR }} wrapMode='word'>
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
            <box style={{ flexDirection: "column", gap: 0 }}>
              <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
                Current branch:
              </text>
              <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
                {"  "}{(status.currentBranch || '(detached)').slice(0, 80)}
              </text>
              <text style={{ fg: Colors.NEUTRAL, marginTop: 1 }} wrapMode='none'>
                Target branch:
              </text>
              <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
                {"  "}{branchName.slice(0, 80)}
              </text>
            </box>

            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
              {repoPath && repoPath.length > 80 ? repoPath.slice(0, 77) + '...' : repoPath}
            </text>

            {hasWarnings && (
              <box
                style={{
                  marginTop: 1,
                  border: true,
                  borderColor: Colors.WARNING,
                  padding: 1,
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
                  ⚠ Working tree status:
                </text>

                {hasUncommittedChanges && (
                  <box style={{ flexDirection: "row", gap: 2 }}>
                    {status.stagedCount > 0 && (
                      <text style={{ fg: Colors.SUCCESS }} wrapMode='none'>
                        Staged: {status.stagedCount}
                      </text>
                    )}
                    {status.unstagedCount > 0 && (
                      <text style={{ fg: Colors.ERROR }} wrapMode='none'>
                        Unstaged: {status.unstagedCount}
                      </text>
                    )}
                  </box>
                )}

                {hasUnpushedCommits && (
                  <box style={{ flexDirection: "column" }}>
                    <text style={{ fg: Colors.INFO }} wrapMode='none'>
                      Unpushed commits: {status.unpushedCommits.length}
                    </text>
                    {status.unpushedCommits.slice(0, 3).map((commit, i) => (
                      <text
                        key={commit.hash}
                        style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                        wrapMode='none'
                      >
                        {`  ${commit.hash} ${commit.subject.slice(0, 50)}${commit.subject.length > 50 ? '...' : ''}`}
                      </text>
                    ))}
                    {status.unpushedCommits.length > 3 && (
                      <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
                        {`  ... and ${status.unpushedCommits.length - 3} more`}
                      </text>
                    )}
                  </box>
                )}
              </box>
            )}

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
