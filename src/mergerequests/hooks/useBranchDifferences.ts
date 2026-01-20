import { useMemo } from 'react';
import { getBranchDifference } from '../../git/git-effects';
import { loadSettings } from '../../settings/settings';
import type { MergeRequest } from '../mergerequest-schema';
import type { BranchDifference } from './useRepositoryBranches';

export const useBranchDifferences = (mergeRequests: MergeRequest[]): Map<string, BranchDifference> => {
  return useMemo(() => {
    const settings = loadSettings();
    const differenceMap = new Map<string, BranchDifference>();

    for (const mr of mergeRequests) {
      const repoConfig = settings.repositoryPaths[mr.project.path];
      const localPath = repoConfig?.localPath;

      if (localPath) {
        const difference = getBranchDifference(localPath, mr.targetbranch, mr.sourcebranch);
        if (difference) {
          differenceMap.set(mr.id, difference);
        }
      }
    }

    return differenceMap;
  }, [mergeRequests]);
};