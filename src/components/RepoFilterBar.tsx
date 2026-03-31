import { TextAttributes } from '@opentui/core';
import { Colors } from '../colors';
import { useAtom, useAtomValue } from "@effect/atom-react";
import { knownProjectsAtom, repoFilterAtom } from '../mergerequests/mergerequests-atom';
import { repositoryFullPath } from '../userselection/userSelection';

export default function RepoFilterBar() {
  const knownProjects = useAtomValue(knownProjectsAtom);
  const [repoFilter, setRepoFilter] = useAtom(repoFilterAtom);

  const allPaths = knownProjects.map(repositoryFullPath);
  if (allPaths.length <= 1) return null;

  const repoFilterSet = new Set(repoFilter);
  const hasFilter = repoFilterSet.size > 0;

  const toggle = (path: string) => {
    if (!hasFilter) {
      setRepoFilter(allPaths.filter(r => r !== path));
    } else if (repoFilterSet.has(path)) {
      const next = repoFilter.filter(r => r !== path);
      setRepoFilter(next.length === 0 ? [] : next);
    } else {
      setRepoFilter([...repoFilter, path]);
    }
  };

  const shortName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] ?? path;
  };

  return (
    <box style={{ minHeight: 1, maxHeight: 2, overflow: "hidden" }}>
      <box style={{ flexDirection: "row", columnGap: 1, rowGap: 0, flexWrap: "wrap" }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          Repos:
        </text>
        {allPaths.map(path => {
          const isActive = !hasFilter || repoFilterSet.has(path);
          return (
            <box
              key={path}
              onMouseDown={() => toggle(path)}
              style={{
                ...(isActive && { backgroundColor: Colors.TRACK }),
                paddingLeft: 1,
                paddingRight: 1,
              }}
            >
              <text
                style={{
                  fg: isActive ? Colors.INFO : Colors.NEUTRAL,
                  attributes: isActive ? TextAttributes.BOLD : TextAttributes.DIM,
                }}
                wrapMode='none'
              >
                {shortName(path)}
              </text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
