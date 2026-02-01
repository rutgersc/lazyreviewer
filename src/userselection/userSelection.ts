import type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { MRCacheKey, ProjectMRCacheKey, type CacheKey } from "../mergerequests/decide-fetch-mrs";

export type UserId =
  | { type: 'userId', id: string }

export type GroupId =
  | { type: 'groupId', id: string }

export type RepositoryId =
  | { type: 'repositoryId', provider: 'gitlab', id: string }
  | { type: 'repositoryId', provider: 'bitbucket', workspace: string, repo: string }

export const repositoryFullPath = (repo: RepositoryId): string =>
  repo.provider === 'gitlab' ? repo.id : `${repo.workspace}/${repo.repo}`

export type UserOrGroupId = | UserId | GroupId | RepositoryId


export interface User {
  type: 'user';
  id: UserId;
}
export interface UserGroup {
  type: 'group';
  name: string;
  id: GroupId;
  children: UserOrGroupId[];
}

export type UserSelection = User | UserGroup;

export type UserSelectionEntry = {
  userSelectionEntryId: string
  name: string
  selection: UserOrGroupId[]
}

export interface UserSelectionState {
  selectedIndex: number | null; // Actually selected item index (space to select)
}


/**
 * Active pane indices for the four pane system
 */
export enum ActivePane {
  Facts = 0,
  MergeRequests = 1,
  UserSelection = 2,
  InfoPane = 3,
  Console = 4
}

export const extractSelectionData = (
  entry: UserSelectionEntry,
  groups: readonly UserGroup[],
  state: MergeRequestState
): CacheKey => {
  const usernames = new Set<string>();
  const repositories: RepositoryId[] = [];

  const processId = (id: UserOrGroupId) => {
    if (id.type === 'userId') {
      usernames.add(id.id);
    } else if (id.type === 'groupId') {
      const group = groups.find(g => g.id.id === id.id);
      if (group) {
        group.children.forEach(processId);
      }
    } else if (id.type === 'repositoryId') {
      repositories.push(id);
    }
  };

  entry.selection.forEach(processId);

  const usernamesArray = Array.from(usernames);

  if (repositories.length > 0 && repositories[0]) {
    return new ProjectMRCacheKey({
      repository: repositories[0],
      state
    });
  } else if (usernamesArray.length > 0) {
    return new MRCacheKey({
      usernames: usernamesArray,
      state
    });
  }

  throw new Error("unreachable");
};

export const getUsernamesFromSelection = (
  entry: UserSelectionEntry,
  groups: readonly UserGroup[]
): Set<string> => {
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
  return usernames;
};

export const findSelectionForAuthor = (
  author: string,
  userSelections: readonly UserSelectionEntry[],
  groups: readonly UserGroup[]
): UserSelectionEntry | null => {
  for (const entry of userSelections) {
    const usernames = getUsernamesFromSelection(entry, groups);
    if (usernames.has(author)) {
      return entry;
    }
  }
  return null;
};
