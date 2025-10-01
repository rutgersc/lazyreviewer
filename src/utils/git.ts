import { execSync } from 'child_process';

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