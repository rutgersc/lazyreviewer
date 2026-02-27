import { useMemo } from 'react';
import { Atom, Result, useAtomValue } from '@effect-atom/atom-react';
import { Stream } from 'effect';
import { repositoryPathsAtom } from '../../settings/settings-atom';
import { getWorktrees, type WorktreeInfo } from '../../git/git-effects';
import { gitHeadFileChanges } from '../../git/git-head-watcher';
import { appAtomRuntime } from '../../appLayerRuntime';
import type { MergeRequest } from '../mergerequest-schema';
import { resolve } from 'path';

const gitHeadVersionAtom = appAtomRuntime.atom(
  Stream.unwrap(gitHeadFileChanges),
  { initialValue: 0 }
).pipe(Atom.setLazy(false), Atom.keepAlive);

export const branchVersionAtom = Atom.make((get): number =>
  Result.match(get(gitHeadVersionAtom), {
    onInitial: () => 0,
    onSuccess: ({ value }) => value,
    onFailure: () => 0,
  })
);

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
  const branchVersion = useAtomValue(branchVersionAtom);

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
  }, [mergeRequests, repositoryPaths, branchVersion]);
};