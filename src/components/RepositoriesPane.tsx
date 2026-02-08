import { useEffect } from 'react';
import { TextAttributes } from '@opentui/core';
import type { RepositoryId } from '../userselection/userSelection';
import { repositoryFullPath } from '../userselection/userSelection';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { Colors } from '../colors';
import { useAtom, useAtomValue, useAtomSet, Atom, Result } from '@effect-atom/atom-react';
import { repoSelectionAtom } from '../settings/settings-atom';
import { knownProjectsAtom } from '../mergerequests/mergerequests-atom';
import { pageSlotsAtom } from '../notifications/notification-sync-atom';
import type { PageSlotSnapshot } from '../notifications/notification-sync-atom';
import { refreshSingleRepoAtom } from './RepositoriesPaneActions';
import { useDoubleClick } from '../hooks/useDoubleClick';


export const highlightIndexAtom = Atom.make(0);
export const scrollToItemRequestAtom = Atom.make<number | null>(null);

type SelectableItem = { repo: RepositoryId; toggled: boolean };

const lerpChannel = (a: number, b: number, t: number): number => a + (b - a) * t;

const slotColor = (minutes: number): string => {
  const t = Math.min(minutes / 60, 1)
  const [r1, g1, b1] = [0x50, 0xfa, 0x7b] // green (#50fa7b) - imminent
  const [r2, g2, b2] = [0x8c, 0x9a, 0xc4] // supporting (#8c9ac4) - far off
  const r = Math.round(lerpChannel(r1, r2, t))
  const g = Math.round(lerpChannel(g1, g2, t))
  const b = Math.round(lerpChannel(b1, b2, t))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
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

  const pageSlotsResult = useAtomValue(pageSlotsAtom);
  const refreshSingleRepo = useAtomSet(refreshSingleRepoAtom);
  const items = buildItems(knownProjects, repos);

  const slotsByRepo = Result.match(pageSlotsResult, {
    onInitial: () => new Map<string, readonly PageSlotSnapshot[]>(),
    onFailure: () => new Map<string, readonly PageSlotSnapshot[]>(),
    onSuccess: (s) => {
      const grouped = new Map<string, PageSlotSnapshot[]>();
      for (const slot of s.value) {
        const arr = grouped.get(slot.repo) ?? [];
        arr.push(slot);
        grouped.set(slot.repo, arr);
      }
      return grouped;
    },
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
      <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
        Background Sync
      </text>

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
          const repoSlots = slotsByRepo.get(label);

          return (
            <box
              key={label}
              style={{
                backgroundColor: isHighlighted ? '#191a21' : 'transparent',
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
              {repoSlots && repoSlots.length > 0 && (
                <scrollbox
                  style={{
                    height: 1,
                    contentOptions: { backgroundColor: isHighlighted ? '#191a21' : Colors.BACKGROUND },
                    viewportOptions: { backgroundColor: isHighlighted ? '#191a21' : Colors.BACKGROUND },
                  }}
                  focused={false}
                >
                  <box style={{ flexDirection: "row", gap: 1 }}>
                    <text wrapMode='none' style={{ fg: Colors.SUPPORTING }}>{'       '}</text>
                    {[...repoSlots].sort((a, b) => a.page - b.page).map(slot => (
                      <text
                        key={slot.page}
                        style={{ fg: slotColor(slot.minutesUntilRefresh) }}
                        wrapMode='none'
                      >
                        {`${slot.minutesUntilRefresh}m`}
                      </text>
                    ))}
                  </box>
                </scrollbox>
              )}
            </box>
          );
        })}
      </scrollbox>
    </>
  );
}
