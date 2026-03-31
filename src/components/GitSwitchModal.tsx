import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { execSync } from "child_process";
import { useState, useEffect } from "react";
import { formatDetachedLabel, getWorkingTreeStatus, getWorktrees, type GitWorkingTreeStatus, type WorktreeInfo } from "../git/git-effects";

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

type ModalPhase = 'worktree-select' | 'confirm';

export default function GitSwitchModal({
  isVisible,
  branchName,
  repoPath,
  onClose,
  onSuccess,
  onError
}: GitSwitchModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('worktree-select');
  const [worktrees, setWorktrees] = useState<readonly WorktreeInfo[]>([]);
  const [selectedWorktreeIndex, setSelectedWorktreeIndex] = useState(0);
  const [status, setStatus] = useState<GitWorkingTreeStatus>(initialStatus);

  const selectWorktree = (index: number) => {
    const path = worktrees[index]?.path;
    if (!path) return;
    setSelectedWorktreeIndex(index);
    setPhase('confirm');
    setStatus(getWorkingTreeStatus(path));
  };

  useEffect(() => {
    if (isVisible && repoPath) {
      const wts = getWorktrees(repoPath);
      setWorktrees(wts);
      setSelectedWorktreeIndex(0);
      if (wts.length <= 1) {
        setPhase('confirm');
        setStatus(getWorkingTreeStatus(wts[0]?.path ?? repoPath));
      } else {
        setPhase('worktree-select');
        setStatus(initialStatus);
      }
    } else {
      setWorktrees([]);
      setSelectedWorktreeIndex(0);
      setPhase('worktree-select');
      setStatus(initialStatus);
    }
  }, [isVisible, repoPath]);

  const selectedWorktreePath = worktrees[selectedWorktreeIndex]?.path ?? repoPath;

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    if (phase === 'worktree-select') {
      const num = parseInt(key.name);
      if (!isNaN(num) && num >= 0 && num < worktrees.length) {
        selectWorktree(num);
        return;
      }

      switch (key.name) {
        case 'j':
        case 'down':
          setSelectedWorktreeIndex(i => i < worktrees.length - 1 ? i + 1 : 0);
          break;
        case 'k':
        case 'up':
          setSelectedWorktreeIndex(i => i > 0 ? i - 1 : worktrees.length - 1);
          break;
        case 'return':
          selectWorktree(selectedWorktreeIndex);
          break;
        case 'escape':
          onClose();
          break;
      }
      return;
    }

    const handleSwitch = () => {
      if (!selectedWorktreePath) return;

      try {
        execSync(`git switch ${branchName}`, {
          cwd: selectedWorktreePath,
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
        if (worktrees.length > 1) {
          setPhase('worktree-select');
        } else {
          onClose();
        }
        break;
      case 'return':
      case 'y':
        handleSwitch();
        break;
    }
  });

  if (!isVisible) return null;

  if (!repoPath) {
    return (
      <ModalOverlay>
        <ModalBox borderColor={Colors.ERROR}>
          <ModalTitle />
          <text style={{ fg: Colors.ERROR }} wrapMode='word'>
            No local repository path configured. Press Ctrl+S to configure settings.
          </text>
          <box style={{ marginTop: 1 }}>
            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}>
              Press ESC to close
            </text>
          </box>
        </ModalBox>
      </ModalOverlay>
    );
  }

  if (phase === 'worktree-select') {
    return (
      <ModalOverlay>
        <ModalBox borderColor={Colors.INFO}>
          <ModalTitle />
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Switch to {branchName.slice(0, 60)} in which worktree?
          </text>
          <box style={{ flexDirection: "column", marginTop: 1 }}>
            {worktrees.map((wt, i) => (
              <text
                key={wt.path}
                style={{
                  fg: i === selectedWorktreeIndex ? Colors.SUCCESS : Colors.NEUTRAL,
                  attributes: i === selectedWorktreeIndex ? TextAttributes.BOLD : 0,
                }}
                wrapMode='none'
              >
                {i === selectedWorktreeIndex ? '> ' : '  '}
                [{i}] {wt.folderName} {wt.branch ? `(${wt.branch})` : formatDetachedLabel(wt)}
                {wt.isMain ? ' [main]' : ''}
              </text>
            ))}
          </box>
          <box style={{ marginTop: 1 }}>
            <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}>
              0-{worktrees.length - 1}/j/k to select, Enter to confirm, ESC to cancel
            </text>
          </box>
        </ModalBox>
      </ModalOverlay>
    );
  }

  const hasUncommittedChanges = status.stagedCount > 0 || status.unstagedCount > 0;
  const hasUnpushedCommits = status.unpushedCommits.length > 0;
  const hasWarnings = hasUncommittedChanges || hasUnpushedCommits;
  const selectedWorktree = worktrees[selectedWorktreeIndex];

  return (
    <ModalOverlay>
      <ModalBox borderColor={hasWarnings ? Colors.WARNING : Colors.SUCCESS}>
        <ModalTitle />

        {selectedWorktree && worktrees.length > 1 && (
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Worktree: [{selectedWorktreeIndex}] {selectedWorktree.folderName}
          </text>
        )}

        <box style={{ flexDirection: "column", gap: 0 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Current branch:
          </text>
          <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {"  "}{(status.currentBranch || formatDetachedLabel(worktrees[selectedWorktreeIndex] ?? { tag: null, head: null, headSubject: null })).slice(0, 80)}
          </text>
          <text style={{ fg: Colors.NEUTRAL, marginTop: 1 }} wrapMode='none'>
            Target branch:
          </text>
          <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {"  "}{branchName.slice(0, 80)}
          </text>
        </box>

        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          {selectedWorktreePath && selectedWorktreePath.length > 80 ? selectedWorktreePath.slice(0, 77) + '...' : selectedWorktreePath}
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
              Working tree status:
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
                {status.unpushedCommits.slice(0, 3).map((commit) => (
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
            {worktrees.length > 1 ? 'Press N or ESC to go back' : 'Press N or ESC to cancel'}
          </text>
        </box>
      </ModalBox>
    </ModalOverlay>
  );
}

const ModalOverlay = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </box>
);

const ModalBox = ({ borderColor, children }: { borderColor: string; children: React.ReactNode }) => (
  <box
    style={{
      width: 90,
      border: true,
      borderColor,
      backgroundColor: Colors.BACKGROUND,
      padding: 2,
      flexDirection: "column",
      gap: 1,
    }}
  >
    {children}
  </box>
);

const ModalTitle = () => (
  <text
    style={{
      fg: Colors.PRIMARY,
      attributes: TextAttributes.BOLD,
    }}
    wrapMode='none'
  >
    Git Switch Branch
  </text>
);
