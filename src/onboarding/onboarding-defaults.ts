import type { UserSelectionEntry } from '../userselection/userSelection'
import { groups } from '../data/usersAndGroups'

export const DEFAULT_GITLAB_REPOS = ['elab/elab', 'elab/BlackLotus', 'elab/helix', 'elab/elab-custom-plugins'] as const
export const DEFAULT_BITBUCKET_REPOS = ['raftdev/core.iam', 'raftdev/Core.AI-Instructions'] as const
export const BITBUCKET_WORKSPACE = 'raftdev'

const florenceBEId = { type: 'groupId' as const, id: 'FlorenceBE' }
const florenceFEId = { type: 'groupId' as const, id: 'FlorenceFE' }
const erlenmeyerBEId = { type: 'groupId' as const, id: 'ErlenmeyerBE' }

export const PREMADE_SELECTIONS: UserSelectionEntry[] = [
  {
    userSelectionEntryId: 'premade-florence',
    name: 'Florence',
    selection: [florenceBEId, florenceFEId],
  },
  {
    userSelectionEntryId: 'premade-florenceBE',
    name: 'Florence BE',
    selection: [florenceBEId],
  },
  {
    userSelectionEntryId: 'premade-florenceFE',
    name: 'Florence FE',
    selection: [florenceFEId],
  },
  {
    userSelectionEntryId: 'premade-erlenmeyer',
    name: 'Erlenmeyer',
    selection: [erlenmeyerBEId],
  },
  {
    userSelectionEntryId: 'premade-erlenmeyerBE',
    name: 'Erlenmeyer BE',
    selection: [erlenmeyerBEId],
  },
]

export const getSelectionMembers = (entry: UserSelectionEntry): string =>
  entry.selection
    .map(s => {
      if (s.type === 'groupId') {
        const group = groups.find(g => g.id.id === s.id)
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
