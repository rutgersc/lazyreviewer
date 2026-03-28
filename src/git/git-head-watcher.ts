import { Effect, Stream } from 'effect';
import { FileSystem } from '@effect/platform';
import { SettingsService } from '../settings/settings';
import { getWorktrees } from './git-effects';
import { join } from 'path';
import type { RepositoryPathConfig } from '../settings/settings';

const getGitHeadPaths = (repositoryPaths: Record<string, RepositoryPathConfig>): string[] => {
  const paths = Object.values(repositoryPaths)
    .filter(config => config.localPath)
    .flatMap(config => {
      const worktrees = getWorktrees(config.localPath);
      const mainWorktree = worktrees.find(wt => wt.isMain);
      if (!mainWorktree) return [];

      const gitDir = join(mainWorktree.path, '.git');

      return worktrees.map(wt =>
        wt.isMain
          ? join(gitDir, 'HEAD')
          : join(gitDir, 'worktrees', wt.folderName, 'HEAD')
      );
    });

  return [...new Set(paths)];
};

export const gitHeadFileChanges = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const settingsService = yield* SettingsService;
  const settings = yield* settingsService.load;

  const headPaths = getGitHeadPaths(settings.repositoryPaths);

  const watchStreams = headPaths.map(path =>
    fs.watch(path).pipe(
      Stream.catch(() => Stream.empty)
    )
  );

  if (watchStreams.length === 0) {
    return Stream.make(0);
  }

  const merged = Stream.mergeAll(watchStreams, { concurrency: "unbounded" }).pipe(
    Stream.debounce("300 millis"),
    Stream.map(() => Date.now())
  );

  return Stream.concat(Stream.make(0), merged);
});
