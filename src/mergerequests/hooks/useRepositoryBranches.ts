import { useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { repositoryPathsAtom } from '../../settings/settings-atom';
import { getCurrentBranch } from '../../git/git-effects';
import type { MergeRequest } from '../mergerequest-schema';

export interface RepositoryBranch {
  projectPath: string;
  projectName: string;
  localPath: string;
  currentBranch: string | null;
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
        const currentBranch = localPath ? getCurrentBranch(localPath) : null;

        return {
          projectPath,
          projectName: projectPath,
          localPath,
          currentBranch
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [mergeRequests, repositoryPaths]);
};