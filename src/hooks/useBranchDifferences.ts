import { useMemo } from 'react';
import { getBranchDifference } from '../git/git-effects';
import { loadSettings } from '../settings/settings';
import type { MergeRequest } from '../mergerequests/mergeRequestSchema';
import type { BranchDifference } from './useRepositoryBranches';

export const useBranchDifferences = (mergeRequests: MergeRequest[]): Map<string, BranchDifference> => {
  return useMemo(() => {
    const settings = loadSettings();
    const differenceMap = new Map<string, BranchDifference>();

    for (const mr of mergeRequests) {
      const localPath = settings.repositoryPaths[mr.project.path];

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