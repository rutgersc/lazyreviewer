import { Atom } from '@effect-atom/atom-react';
import { Stream } from 'effect';
import { basename, resolve } from 'path';
import { repositoryPathsAtom } from '../../settings/settings-atom';
import { getWorktrees, type WorktreeInfo } from '../../git/git-effects';
import { gitHeadFileChanges } from '../../git/git-head-watcher';
import { appAtomRuntime } from '../../appLayerRuntime';

const gitHeadVersionAtom = appAtomRuntime.atom(
  Stream.unwrap(gitHeadFileChanges),
  { initialValue: 0 }
).pipe(Atom.setLazy(false), Atom.keepAlive);

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

export type WorktreeMatch = { index: number; folderName: string };

export const repositoryBranchesAtom = Atom.make((get): RepositoryBranch[] => {
  const repositoryPaths = get(repositoryPathsAtom);

  return Object.entries(repositoryPaths)
    .map(([projectPath, config]) => {
      const localPath = config.localPath || '';
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
}).pipe(Atom.makeRefreshOnSignal(gitHeadVersionAtom));

export const projectBranchMapAtom = Atom.make((get) => {
  const repositoryBranches = get(repositoryBranchesAtom);
  return new Map(
    repositoryBranches.map(repo => {
      const additionalWorktrees = repo.worktrees.map((wt, index) => ({
        index: index + 1,
        folderName: wt.folderName,
        branch: wt.branch
      }));
      const mainWorktree = repo.localPath
        ? [{ index: 0, folderName: basename(repo.localPath), branch: repo.currentBranch }]
        : [];
      return [
        repo.projectPath,
        {
          currentBranch: repo.currentBranch,
          worktreeBranches: new Map(
            additionalWorktrees
              .filter(wt => wt.branch !== null)
              .map(wt => [wt.branch!, { index: wt.index, folderName: wt.folderName }])
          ),
          allWorktrees: [...mainWorktree, ...additionalWorktrees]
        }
      ] as const;
    })
  );
});
