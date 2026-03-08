import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { Colors } from '../colors';
import { userGroupsAtom, setUserFilterAtom, repoSelectionAtom } from '../settings/settings-atom';
import { knownProjectsAtom, refreshMergeRequestsAtom } from '../mergerequests/mergerequests-atom';
import { refreshSingleRepoAtom } from './RepositoriesPaneActions';
import { repositoryFullPath } from '../userselection/userSelection';
import PickerModal, { type PickerItem, type PickerHint } from './PickerModal';

interface RefreshPickerModalProps {
  readonly isVisible: boolean
  readonly onClose: () => void
}

const HINTS: readonly PickerHint[] = [
  { key: 'Enter', description: 'refresh selected' },
  { key: 'Esc', description: 'close' },
];

export default function RefreshPickerModal({ isVisible, onClose }: RefreshPickerModalProps) {
  const groups = useAtomValue(userGroupsAtom);
  const knownProjects = useAtomValue(knownProjectsAtom);
  const customRepos = useAtomValue(repoSelectionAtom);

  const setUserFilter = useAtomSet(setUserFilterAtom);
  const refreshMergeRequests = useAtomSet(refreshMergeRequestsAtom, { mode: 'promiseExit' });
  const refreshSingleRepo = useAtomSet(refreshSingleRepoAtom, { mode: 'promiseExit' });

  const repoFullPaths = [
    ...new Set([
      ...knownProjects.map(repositoryFullPath),
      ...customRepos,
    ]),
  ].sort();

  const items: readonly PickerItem[] = [
    ...groups.map(g => ({
      id: `group:${g.id}`,
      label: `group  ${g.name}`,
      searchText: g.name,
      labelColor: Colors.NEUTRAL,
    })),
    ...repoFullPaths.map(path => ({
      id: `repo:${path}`,
      label: `repo   ${path}`,
      searchText: path,
      labelColor: Colors.INFO,
    })),
  ].sort((a, b) => a.searchText.localeCompare(b.searchText));

  const handleSelect = (item: PickerItem) => {
    if (item.id.startsWith('group:')) {
      const groupId = item.id.slice('group:'.length);
      setUserFilter({ usernames: [], groupIds: [groupId] });
      refreshMergeRequests();
    } else {
      const repoPath = item.id.slice('repo:'.length);
      refreshSingleRepo({ repoPath, deep: false });
    }
    onClose();
  };

  return (
    <PickerModal
      isVisible={isVisible}
      title="Refresh"
      placeholder="search groups & repos..."
      items={items}
      hints={HINTS}
      borderColor={Colors.WARNING}
      emptyMessage="No groups or repos found"
      onSelect={handleSelect}
      onClose={onClose}
    />
  );
}
