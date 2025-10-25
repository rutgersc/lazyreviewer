import { getBranchDifference } from '../git/git-effects';
import { loadSettings } from '../settings/settings';
import type { MergeRequest } from '../schemas/mergeRequestSchema';
import type { BranchDifference } from '../hooks/useRepositoryBranches';

export async function fetchBranchDifferences(mergeRequests: MergeRequest[]): Promise<Map<string, BranchDifference>> {
  const settings = loadSettings();
  const differenceMap = new Map<string, BranchDifference>();

  const promises = mergeRequests.map(async (mr) => {
    const localPath = settings.repositoryPaths[mr.project.path];

    if (localPath) {
      const difference = getBranchDifference(localPath, mr.targetbranch, mr.sourcebranch);
      if (difference) {
        return { id: mr.id, difference };
      }
    }
    return null;
  });

  const results = await Promise.all(promises);

  for (const result of results) {
    if (result) {
      differenceMap.set(result.id, result.difference);
    }
  }

  return differenceMap;
}
