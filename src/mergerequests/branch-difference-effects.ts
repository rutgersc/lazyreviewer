import { Effect } from 'effect';
import { getBranchDifference } from '../git/git-effects';
import { SettingsService } from '../settings/settings';
import type { MergeRequest } from './mergerequest-schema';
import type { BranchDifference } from './hooks/useRepositoryBranches';

export const fetchBranchDifferences = (mergeRequests: MergeRequest[]) =>
  Effect.gen(function* () {
    const settings = yield* SettingsService.load;
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
  });
