import { useEffect } from 'react';
import { TextAttributes } from '@opentui/core';
import type { RepositoryId } from '../userselection/userSelection';
import { repositoryFullPath } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { Colors } from '../colors';
import { Atom, AsyncResult } from "effect/unstable/reactivity"
import { useAtom, useAtomValue, useAtomSet } from "@effect/atom-react";
import { repoSelectionAtom, backgroundSyncSettingsAtom, toggleBackgroundSyncAtom } from '../settings/settings-atom';
import { knownProjectsAtom } from '../mergerequests/mergerequests-atom';
import { repoSyncSnapshotsAtom } from '../notifications/notification-sync-atom';
import type { RepoSyncSnapshot } from '../notifications/notification-sync-atom';
import { refreshSingleRepoAtom, openCredentialsFileAtom } from './RepositoriesPaneActions';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { formatClockTime } from '../utils/formatting';


export const highlightIndexAtom = Atom.make(0);
export const scrollToItemRequestAtom = Atom.make<number | null>(null);

type SelectableItem = { repo: RepositoryId; toggled: boolean };

const lerpChannel = (a: number, b: number, t: number): number => a + (b - a) * t;

const refreshColor = (minutes: number): string => {
  const t = Math.min(minutes / 60, 1)
  const [r1, g1, b1] = [0x50, 0xfa, 0x7b] // green (#50fa7b) - imminent
  const [r2, g2, b2] = [0x8c, 0x9a, 0xc4] // supporting (#8c9ac4) - far off
  const r = Math.round(lerpChannel(r1, r2, t))
  const g = Math.round(lerpChannel(g1, g2, t))
  const b = Math.round(lerpChannel(b1, b2, t))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
};

const dueAt = (snapshot: RepoSyncSnapshot): { label: string; color: string } => {
  if (snapshot.isSweeping) return { label: 'syncing…', color: Colors.PRIMARY };
  if (snapshot.nextRefreshAt === null) return { label: snapshot.isNext ? 'next' : 'due', color: Colors.SUCCESS };

  const msRemaining = snapshot.nextRefreshAt - Date.now();
  if (msRemaining <= 0) return { label: snapshot.isNext ? 'next' : 'due', color: Colors.SUCCESS };

  const clock = formatClockTime(new Date(snapshot.nextRefreshAt));
  return {
    label: snapshot.isNext ? `${clock} ▸` : clock,
    color: refreshColor(msRemaining / 60000),
  };
};

const buildItems = (
  knownProjects: readonly RepositoryId[],
  customRepos: readonly string[],
): readonly SelectableItem[] => {
  const repoSet = new Set(customRepos);
  const allRepoFullPaths = new Set([...knownProjects.map(repositoryFullPath), ...customRepos]);
  const repoByPath = new Map(knownProjects.map(r => [repositoryFullPath(r), r]));

  return [...allRepoFullPaths].sort().map(path => ({
    repo: repoByPath.get(path) ?? { type: 'repositoryId', provider: 'gitlab', id: path } as RepositoryId,
    toggled: repoSet.has(path),
  }));
};

export default function RepositoriesPane() {
  const [repos, setRepos] = useAtom(repoSelectionAtom);
  const knownProjects = useAtomValue(knownProjectsAtom);
  const [highlightIndex, setHighlightIndex] = useAtom(highlightIndexAtom);
  const [scrollToItemRequest, setScrollToItemRequest] = useAtom(scrollToItemRequestAtom);
  const { scrollBoxRef, scrollToItem } = useAutoScroll({ lookahead: 2 });

  const repoSyncSnapshotsResult = useAtomValue(repoSyncSnapshotsAtom);
  const refreshSingleRepo = useAtomSet(refreshSingleRepoAtom);
  const backgroundSyncSettings = useAtomValue(backgroundSyncSettingsAtom);
  const toggleBackgroundSync = useAtomSet(toggleBackgroundSyncAtom, { mode: 'promiseExit' });
  const openCredentialsFile = useAtomSet(openCredentialsFileAtom);
  const items = buildItems(knownProjects, repos);

  const snapshotByRepo = AsyncResult.match(repoSyncSnapshotsResult, {
    onInitial: () => new Map<string, RepoSyncSnapshot>(),
    onFailure: () => new Map<string, RepoSyncSnapshot>(),
    onSuccess: (s) => new Map(s.value.map(snapshot => [snapshot.repo, snapshot])),
  });

  const handleRepoClick = useDoubleClick<string>({
    onSingleClick: (path) => {
      const idx = items.findIndex(i => repositoryFullPath(i.repo) === path);
      if (idx >= 0) setHighlightIndex(idx);
    },
    onDoubleClick: (path) => {
      const idx = items.findIndex(i => repositoryFullPath(i.repo) === path);
      if (idx >= 0) setHighlightIndex(idx);
      const updated = repos.includes(path)
        ? repos.filter(r => r !== path)
        : [...repos, path];
      setRepos(updated);
    },
  });

  useEffect(() => {
    if (scrollToItemRequest !== null) {
      scrollToItem(scrollToItemRequest);
      setScrollToItemRequest(null);
    }
  }, [scrollToItemRequest, scrollToItem, setScrollToItemRequest]);

  return (
    <>
      <box style={{ flexDirection: "row", paddingBottom: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Background Sync
        </text>
        <text
          style={{ fg: backgroundSyncSettings.enabled ? Colors.SUCCESS : Colors.NEUTRAL }}
          wrapMode='none'
          onMouseDown={() => toggleBackgroundSync()}
        >
          {backgroundSyncSettings.enabled ? ' ON ' : ' OFF'}
        </text>
        <text
          style={{ fg: Colors.PRIMARY, flexGrow: 1 }}
          wrapMode='none'
          onMouseDown={() => openCredentialsFile()}
        >
          {'   [⚙ Credentials]'}
        </text>
      </box>

      <scrollbox
        ref={scrollBoxRef}
        style={{
          flexGrow: 1,
          height: '70%',
          contentOptions: { backgroundColor: Colors.BACKGROUND },
          viewportOptions: { backgroundColor: Colors.BACKGROUND },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.TRACK,
            },
          },
        }}
        focused={false}
      >
        {items.map((item, index) => {
          const isHighlighted = index === highlightIndex;
          const checkbox = item.toggled ? '[x]' : '[ ]';
          const label = repositoryFullPath(item.repo);
          const color = item.toggled ? Colors.INFO : Colors.NEUTRAL;
          const repoSnapshot = snapshotByRepo.get(label);

          return (
            <box
              key={label}
              style={{
                backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
              }}
            >
              <box style={{ flexDirection: "row" }}>
                <text
                  style={{ fg: color, flexGrow: 1 }}
                  wrapMode='none'
                  onMouseDown={() => handleRepoClick(label)}
                >
                  {`  ${checkbox} ${label}`}
                </text>
                <text
                  style={{ fg: Colors.SUPPORTING }}
                  wrapMode='none'
                  onMouseDown={() => refreshSingleRepo({ repoPath: label, deep: false })}
                >
                  {' [r]'}
                </text>
                <text
                  style={{ fg: Colors.SUPPORTING }}
                  wrapMode='none'
                  onMouseDown={() => refreshSingleRepo({ repoPath: label, deep: true })}
                >
                  {' [R]'}
                </text>
              </box>
              <scrollbox
                style={{
                  height: 1,
                  contentOptions: { backgroundColor: isHighlighted ? Colors.SELECTED : Colors.BACKGROUND },
                  viewportOptions: { backgroundColor: isHighlighted ? Colors.SELECTED : Colors.BACKGROUND },
                }}
                focused={false}
                onMouseDown={() => handleRepoClick(label)}
              >
                <box style={{ flexDirection: "row", gap: 1 }}>
                  <text wrapMode='none' style={{ fg: Colors.SUPPORTING }}>{'       '}</text>
                  {repoSnapshot
                    ? (() => {
                        const { label, color } = dueAt(repoSnapshot);
                        // No count until the repo has actually been swept — "0 MRs" would be a lie.
                        const prefix = repoSnapshot.nextRefreshAt === null ? '' : `${repoSnapshot.mrCount} MRs · `;
                        return (
                          <text style={{ fg: color }} wrapMode='none'>
                            {`${prefix}${label}`}
                          </text>
                        );
                      })()
                    : <text wrapMode='none' style={{ fg: Colors.SUPPORTING }}>{'—'}</text>
                  }
                </box>
              </scrollbox>
            </box>
          );
        })}
      </scrollbox>
    </>
  );
}
