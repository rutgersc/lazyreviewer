import { Atom, Result } from "@effect-atom/atom-react";
import { Console, Effect } from "effect";
import { parseKeyString } from "../actions/key-matcher";
import { repoSelectionAtom } from "../settings/settings-atom";
import { allMrsAtom, knownProjectsAtom } from "../mergerequests/mergerequests-atom";
import { highlightIndexAtom, scrollToItemRequestAtom } from "./RepositoriesPane";
import type { Action } from "../actions/action-types";
import { repositoryFullPath, resolveRepoPath, type RepositoryId } from "../userselection/userSelection";
import { fetchRepoPage, deepFetchProjectMrs, getKnownMrsForCacheKey, ProjectMRCacheKey } from "../mergerequests/decide-fetch-mrs";
import { withFetchLock } from "../notifications/background-sync-service";
import { appAtomRuntime } from "../appLayerRuntime";
import type { MrGid } from "../domain/identifiers";
import type { MergeRequest } from "../mergerequests/mergerequest-schema";

const getItemCount = (
  knownProjects: readonly RepositoryId[],
  customRepos: readonly string[],
): number =>
  new Set([...knownProjects.map(repositoryFullPath), ...customRepos]).size;

const getItemAtIndex = (
  index: number,
  knownProjects: readonly RepositoryId[],
  customRepos: readonly string[],
): string | undefined =>
  [...new Set([...knownProjects.map(repositoryFullPath), ...customRepos])].sort()[index];

export const refreshSingleRepoAtom = appAtomRuntime.fn(({ repoPath, deep }: { repoPath: string; deep: boolean }, get) =>
  Effect.gen(function* () {
    const knownProjects = get(knownProjectsAtom);
    const repo = resolveRepoPath(repoPath, knownProjects);
    const allMrsResult = get(allMrsAtom);
    const mrsByGid = Result.match(allMrsResult, {
      onInitial: () => new Map<MrGid, MergeRequest>(),
      onSuccess: (s) => s.value.mrsByGid,
      onFailure: () => new Map<MrGid, MergeRequest>(),
    });
    const knownMrs = getKnownMrsForCacheKey(mrsByGid, new ProjectMRCacheKey({ repository: repo, state: 'opened' }));
    if (deep) {
      yield* deepFetchProjectMrs(repo, 'opened', knownMrs);
    } else {
      yield* fetchRepoPage(repo, 'opened', knownMrs, null);
    }
  }).pipe(
    withFetchLock,
    Effect.catchTag("FetchLockBusy", () => Console.log("[ManualRefresh] Skipped: sync in progress")),
    Effect.catchAllCause((cause) => Console.error("Error refreshing single repo:", cause)),
  )
);

export const repositoriesPaneActionsAtom = Atom.make((get): Action[] => {
  const registry = get.registry;

  const actions: Action[] = [
    {
      id: 'repos:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k',
      description: 'Navigate',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const count = getItemCount(registry.get(knownProjectsAtom), registry.get(repoSelectionAtom));
        const newIndex = Math.min(highlightIndex + 1, count - 1);
        registry.set(highlightIndexAtom, newIndex);
        registry.set(scrollToItemRequestAtom, newIndex);
      },
    },
    {
      id: 'repos:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const newIndex = Math.max(highlightIndex - 1, 0);
        registry.set(highlightIndexAtom, newIndex);
        registry.set(scrollToItemRequestAtom, newIndex);
      },
    },
    {
      id: 'repos:toggle',
      keys: [parseKeyString('space')],
      displayKey: 'Space',
      description: 'Toggle repo',
      handler: () => {
        const highlightIndex = registry.get(highlightIndexAtom);
        const knownProjects = registry.get(knownProjectsAtom);
        const customRepos = registry.get(repoSelectionAtom);
        const path = getItemAtIndex(highlightIndex, knownProjects, customRepos);
        if (!path) return;

        const current = registry.get(repoSelectionAtom);
        const updated = current.includes(path)
          ? current.filter(r => r !== path)
          : [...current, path];
        registry.set(repoSelectionAtom, updated);
      },
    },
    {
      id: 'repos:clear',
      keys: [parseKeyString('x')],
      displayKey: 'x',
      description: 'Clear all',
      handler: () => {
        registry.set(repoSelectionAtom, []);
      },
    },
    {
      id: 'repos:refresh-recent',
      keys: [parseKeyString('r')],
      displayKey: 'r/R',
      description: 'Refresh repo',
      handler: () => {
        const path = getItemAtIndex(registry.get(highlightIndexAtom), registry.get(knownProjectsAtom), registry.get(repoSelectionAtom));
        if (path) registry.set(refreshSingleRepoAtom, { repoPath: path, deep: false });
      },
    },
    {
      id: 'repos:refresh-deep',
      keys: [parseKeyString('R')],
      displayKey: '',
      description: '',
      handler: () => {
        const path = getItemAtIndex(registry.get(highlightIndexAtom), registry.get(knownProjectsAtom), registry.get(repoSelectionAtom));
        if (path) registry.set(refreshSingleRepoAtom, { repoPath: path, deep: true });
      },
    },
    {
      id: 'repos:reset',
      keys: [parseKeyString('escape')],
      displayKey: 'Esc',
      description: 'Reset highlight',
      handler: () => {
        registry.set(highlightIndexAtom, 0);
      },
    },
  ];

  return actions;
});
