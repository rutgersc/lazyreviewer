import { useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { repositoryPathsAtom } from '../../settings/settings-atom';
import { getWorktrees, type WorktreeInfo } from '../../git/git-effects';
import type { MergeRequest } from '../mergerequest-schema';
import { resolve } from 'path';

export interface RepositoryBranch {
  projectPath: string;
  projectName: string;
  localPath: string;
  currentBranch: string | null;
  worktrees: readonly WorktreeInfo[];
}

export interface BranchDifference {
  behind: number;
  ahead: number;
}

export const useRepositoryBranches = (mergeRequests: readonly MergeRequest[]): RepositoryBranch[] => {
  const repositoryPaths = useAtomValue(repositoryPathsAtom);

  return useMemo(() => {
    const projectPaths = new Set(mergeRequests.map(mr => mr.project.fullPath));

    return [...projectPaths]
      .map(projectPath => {
        const repoConfig = repositoryPaths[projectPath];
        const localPath = repoConfig?.localPath || '';
        const allWorktrees = localPath ? getWorktrees(localPath) : [];
        const normalizedLocal = localPath ? resolve(localPath).toLowerCase() : '';
        const isCurrentWorktree = (wt: WorktreeInfo) =>
          resolve(wt.path).toLowerCase() === normalizedLocal;
        const currentBranch = allWorktrees.find(isCurrentWorktree)?.branch ?? null;

        return {
          projectPath,
          projectName: projectPath,
          localPath,
          currentBranch,
          worktrees: allWorktrees.filter(wt => !isCurrentWorktree(wt))
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [mergeRequests, repositoryPaths]);
};