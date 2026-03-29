import type { UserSelectionEntry } from '../userselection/userSelection'
import { settingsGroupsToUserGroups } from '../userselection/userSelection'
import { DEFAULT_GROUPS, DEFAULT_USERS } from '../data/default-users-and-groups'

export const DEFAULT_GITLAB_REPOS: readonly string[] = []
export const DEFAULT_BITBUCKET_REPOS: readonly string[] = []
export const BITBUCKET_WORKSPACE = ''

export const PREMADE_SELECTIONS: UserSelectionEntry[] = []

const defaultGroups = settingsGroupsToUserGroups(DEFAULT_GROUPS, DEFAULT_USERS)

export const getSelectionMembers = (entry: UserSelectionEntry): string =>
  entry.selection
    .map(s => {
      if (s.type === 'groupId') {
        const group = defaultGroups.find(g => g.id.id === s.id)
        return group ? group.children
          .filter(c => c.type === 'userId')
          .map(c => c.userId)
          .join(', ') : s.id
      }
      if (s.type === 'userId') return s.userId
      return ''
    })
    .filter(Boolean)
    .join(', ')
