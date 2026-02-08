import { execSync, spawnSync } from 'child_process';
import { Effect } from 'effect';
import { statSync } from 'fs';
import { basename, join } from 'path';

export const getCurrentBranch = (repoPath: string): string | null => {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return branch;
  } catch {
    return null;
  }
};

export const getBranchDifference = (repoPath: string, targetBranch: string, sourceBranch: string): { behind: number; ahead: number } | null => {
  try {
    // Get commits that source branch is behind target (commits in target not in source)
    const behindOutput = execSync(`git rev-list --count origin/${sourceBranch}..origin/${targetBranch}`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    // Get commits that source branch is ahead of target (commits in source not in target)
    const aheadOutput = execSync(`git rev-list --count origin/${targetBranch}..origin/${sourceBranch}`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    const behind = parseInt(behindOutput, 10);
    const ahead = parseInt(aheadOutput, 10);

    return { behind, ahead };
  } catch {
    return null;
  }
};

/**
 * Check if a fetch is needed by examining .git/FETCH_HEAD modification time.
 * Returns true if FETCH_HEAD doesn't exist or is older than maxAgeMinutes.
 */
export const isFetchNeeded = (
  repoPath: string,
  maxAgeMinutes: number = 5
): boolean => {
  try {
    const fetchHeadPath = join(repoPath, '.git', 'FETCH_HEAD');
    const stats = statSync(fetchHeadPath);
    const ageMs = Date.now() - stats.mtimeMs;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    return ageMs > maxAgeMs;
  } catch {
    // File doesn't exist or error reading - fetch is needed
    return true;
  }
};

export const fetchRemote = (
  repoPath: string,
  remoteName: string
): Effect.Effect<string, unknown, never> => {
  return Effect.try({
    try: () => {
      const result = spawnSync('git', ['fetch', remoteName], {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000,
        windowsHide: true
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(result.stderr || `git fetch failed with code ${result.status}`);
      return result.stdout;
    },
    catch: cause => cause
  });
};

/**
 * Get the commit SHA of a branch on a specific remote.
 * Returns the commit SHA string or null if not found.
 */
export const getRemoteBranchCommit = (
  repoPath: string,
  remoteName: string,
  branchName: string
): string | null => {
  try {
    const commit = execSync(`git rev-parse ${remoteName}/${branchName}`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return commit || null;
  } catch {
    return null;
  }
};

export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string | null;
  readonly folderName: string;
  readonly isMain: boolean;
}

export const getWorktrees = (repoPath: string): readonly WorktreeInfo[] => {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    return output
      .split('\n\n')
      .filter(block => block.trim().length > 0)
      .map((block, index) => {
        const lines = block.trim().split('\n');
        const worktreeLine = lines.find(l => l.startsWith('worktree '));
        const branchLine = lines.find(l => l.startsWith('branch '));
        const isBare = lines.some(l => l === 'bare');

        const path = worktreeLine?.slice('worktree '.length) ?? '';
        const rawBranch = branchLine?.slice('branch '.length) ?? null;
        const branch = rawBranch?.replace('refs/heads/', '') ?? null;

        return {
          path,
          branch,
          folderName: basename(path),
          isMain: index === 0 || isBare
        };
      });
  } catch {
    return [];
  }
};

export interface GitWorkingTreeStatus {
  currentBranch: string | null;
  stagedCount: number;
  unstagedCount: number;
  unpushedCommits: readonly { hash: string; subject: string }[];
}

export const getWorkingTreeStatus = (repoPath: string): GitWorkingTreeStatus => {
  const currentBranch = getCurrentBranch(repoPath);

  const stagedCount = (() => {
    try {
      const output = execSync('git diff --cached --numstat', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return output.trim().split('\n').filter(line => line.length > 0).length;
    } catch {
      return 0;
    }
  })();

  const unstagedCount = (() => {
    try {
      const output = execSync('git status --porcelain', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return output.trim().split('\n')
        .filter(line => line.length > 0 && !line.startsWith('A ') && !line.startsWith('M ') && !line.startsWith('D '))
        .length;
    } catch {
      return 0;
    }
  })();

  const unpushedCommits = (() => {
    if (!currentBranch) return [];
    try {
      const upstream = execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      if (!upstream) return [];

      const output = execSync(`git log ${upstream}..HEAD --format=%h|%s`, {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      return output.trim().split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          const [hash, ...subjectParts] = line.split('|');
          return { hash: hash || '', subject: subjectParts.join('|') };
        });
    } catch {
      return [];
    }
  })();

  return { currentBranch, stagedCount, unstagedCount, unpushedCommits };
};