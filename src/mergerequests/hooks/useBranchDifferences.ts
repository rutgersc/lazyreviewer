import { useMemo } from 'react';
import { useAtomValue } from "@effect/atom-react";
import { getBranchDifference } from '../../git/git-effects';
import { repositoryPathsAtom } from '../../settings/settings-atom';
import type { MergeRequest } from '../mergerequest-schema';
import type { BranchDifference } from './useRepositoryBranches';

export const useBranchDifferences = (mergeRequests: MergeRequest[]): Map<string, BranchDifference> => {
  const repositoryPaths = useAtomValue(repositoryPathsAtom);

  return useMemo(() => {
    const differenceMap = new Map<string, BranchDifference>();

    for (const mr of mergeRequests) {
      const repoConfig = repositoryPaths[mr.project.path];
      const localPath = repoConfig?.localPath;

      if (localPath) {
        const difference = getBranchDifference(localPath, mr.targetbranch, mr.sourcebranch);
        if (difference) {
          differenceMap.set(mr.id, difference);
        }
      }
    }

    return differenceMap;
  }, [mergeRequests, repositoryPaths]);
};
