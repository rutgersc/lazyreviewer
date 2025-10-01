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
  MergeRequestDetails = 0,
  MergeRequests = 1,
  UserSelection = 2,
  Console = 3
}