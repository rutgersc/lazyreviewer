
export type Provider = 'gitlab' | 'bitbucket'

export type UserId = {
  type: 'userId'
  userId: string
  gitlab?: string
  bitbucket?: string
  jira?: string // Jira accountId
}

export type AuthorIdentity =
  | { provider: 'gitlab'; username: string }
  | { provider: 'bitbucket'; username: string }
  | { provider: 'jira'; accountId: string }

export const isCurrentUser = (currentUser: UserId, author: AuthorIdentity): boolean => {
  switch (author.provider) {
    case 'gitlab': return currentUser.gitlab === author.username
    case 'bitbucket': return currentUser.bitbucket === author.username
    case 'jira': return currentUser.jira === author.accountId
  }
}

export const authorIdentityKey = (author: AuthorIdentity): string =>
  author.provider === 'jira'
    ? `jira:${author.accountId}`
    : `${author.provider}:${author.username}`

export const mrProviderAuthor = (provider: Provider, username: string): AuthorIdentity =>
  provider === 'gitlab'
    ? { provider: 'gitlab', username }
    : { provider: 'bitbucket', username }

export type GroupId =
  | { type: 'groupId', id: string }

export type RepositoryId =
  | { type: 'repositoryId', provider: 'gitlab', id: string }
  | { type: 'repositoryId', provider: 'bitbucket', workspace: string, repo: string }

export const repositoryFullPath = (repo: RepositoryId): string =>
  repo.provider === 'gitlab' ? repo.id : `${repo.workspace}/${repo.repo}`

export const resolveRepoPath = (path: string, knownProjects: readonly RepositoryId[]): RepositoryId =>
  knownProjects.find(r => repositoryFullPath(r) === path)
    ?? { type: 'repositoryId', provider: 'gitlab', id: path };

export type UserOrGroupId = | UserId | GroupId


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

export type ResolvedSelection = {
  readonly users: readonly UserId[]
}

const resolveIds = (
  ids: readonly UserOrGroupId[],
  groups: readonly UserGroup[]
): readonly UserId[] => {
  const processId = (id: UserOrGroupId): readonly UserId[] => {
    if (id.type === 'userId') return [id];
    const group = groups.find(g => g.id.id === id.id);
    return group ? group.children.flatMap(processId) : [];
  };
  return ids.flatMap(processId);
};

export const resolveSelection = (
  entry: UserSelectionEntry,
  groups: readonly UserGroup[]
): ResolvedSelection => ({
  users: resolveIds(entry.selection, groups)
});

export const resolveGroupIds = (
  groupIds: readonly string[],
  groups: readonly UserGroup[]
): readonly UserId[] =>
  resolveIds(
    groupIds.map((id): GroupId => ({ type: 'groupId', id })),
    groups
  );

export const getUsersFromSelection = (
  entry: UserSelectionEntry,
  groups: readonly UserGroup[]
): readonly UserId[] =>
  resolveSelection(entry, groups).users;

export const findSelectionForAuthor = (
  author: AuthorIdentity,
  userSelections: readonly UserSelectionEntry[],
  groups: readonly UserGroup[]
): UserSelectionEntry | null => {
  for (const entry of userSelections) {
    const users = getUsersFromSelection(entry, groups);
    if (users.some(u => isCurrentUser(u, author))) {
      return entry;
    }
  }
  return null;
};
