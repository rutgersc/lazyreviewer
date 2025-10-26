import type { MergeRequestState } from "../generated/gitlab-sdk";
import { MRCacheKey, ProjectMRCacheKey, type CacheKey } from "../mergerequests/mergerequests-caching-effects";

export type UserId =
  | { type: 'userId', id: string }

export type GroupId =
  | { type: 'groupId', id: string }

export type RepositoryId =
  | { type: 'repositoryId', id: string }

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
  MergeRequests = 0,
  UserSelection = 1,
  InfoPane = 2,
  Console = 3
}

export const extractSelectionData = (
  entry: UserSelectionEntry | undefined,
  groups: UserGroup[],
  state: MergeRequestState
): CacheKey | undefined => {
  if (!entry) return undefined;

  const usernames = new Set<string>();
  const repositories = new Set<string>();

  const processId = (id: UserOrGroupId) => {
    if (id.type === 'userId') {
      usernames.add(id.id);
    } else if (id.type === 'groupId') {
      const group = groups.find(g => g.id.id === id.id);
      if (group) {
        group.children.forEach(processId);
      }
    } else if (id.type === 'repositoryId') {
      repositories.add(id.id);
    }
  };

  entry.selection.forEach(processId);

  const repositoriesArray = Array.from(repositories);
  const usernamesArray = Array.from(usernames);

  if (repositoriesArray.length > 0 && repositoriesArray[0]) {
    return new ProjectMRCacheKey({
      projectPath: repositoriesArray[0],
      state
    });
  } else if (usernamesArray.length > 0) {
    return new MRCacheKey({
      usernames: usernamesArray,
      state
    });
  }

  return undefined;
};
