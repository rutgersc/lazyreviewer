import type { UserSelection, UserSelectionState, UserGroup, UserSelectionEntry, UserId, GroupId, UserOrGroupId } from '../types/userSelection';

export const extractUsernamesFromUserSelectionEntry = (
  userSelectionEntryId: string,
  userSelections: UserSelectionEntry[],
  users: UserSelection[],
  groups: UserGroup[]
): string[] => {
  const entry = userSelections.find(e => e.userSelectionEntryId === userSelectionEntryId);
  if (!entry) return [];

  const usernames = new Set<string>();

  const processId = (id: UserOrGroupId) => {
    if (id.type === 'userId') {
      usernames.add(id.id);
    } else if (id.type === 'groupId') {
      const group = groups.find(g => g.id.id === id.id);
      if (group) {
        group.children.forEach(processId);
      }
    }
  };

  entry.selection.forEach(processId);
  return Array.from(usernames);
};
