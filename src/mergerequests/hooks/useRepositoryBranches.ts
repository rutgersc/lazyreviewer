import { useMemo } from 'react';
import { loadSettings, saveSettings } from '../../settings/settings';
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
  return useMemo(() => {
    const settings = loadSettings();
    const projectPaths = new Set(mergeRequests.map(mr => mr.project.fullPath));
    let settingsModified = false;

    const repoBranches: RepositoryBranch[] = [];

    for (const projectPath of projectPaths) {
      let repoConfig = settings.repositoryPaths[projectPath];

      if (!repoConfig) {
        settings.repositoryPaths[projectPath] = { localPath: '', remoteName: 'origin' };
        settingsModified = true;
        repoConfig = settings.repositoryPaths[projectPath];
      }

      const localPath = repoConfig?.localPath || '';
      const currentBranch = localPath ? getCurrentBranch(localPath) : null;
      const projectName = projectPath;

      repoBranches.push({
        projectPath,
        projectName,
        localPath,
        currentBranch
      });
    }

    if (settingsModified) {
      saveSettings(settings);
    }

    return repoBranches.sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [mergeRequests]);
};