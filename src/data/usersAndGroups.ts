import type { GroupId, UserGroup, UserId, UserSelection, UserSelectionEntry, RepositoryId } from '../types/userSelection';

const rutger = { type: 'userId', id: 'r.schoorstra'  } satisfies UserId;
const menno = { type: 'userId', id: 'MennoGerbens'  } satisfies UserId;
const kimberley = { type: 'userId', id: 'kimberley'  } satisfies UserId;
const rp = { type: 'userId', id: 'Rinze-PieterJonker'  } satisfies UserId;
const martin = { type: 'userId', id: 'm.bures'  } satisfies UserId;
const arjen = { type: 'userId', id: 'arjenpost'  } satisfies UserId;

const elabRepo = { type: 'repositoryId', id: 'elab/elab'  } satisfies RepositoryId;
const blackLotusRepo = { type: 'repositoryId', id: 'elab/BlackLotus'  } satisfies RepositoryId;
const dbSplitterRepo = { type: 'repositoryId', id: 'elab/db-splitter'  } satisfies RepositoryId;
export const users: UserSelection[] = [
  { type: 'user', id: rutger },
  { type: 'user', id: menno },
  { type: 'user', id: kimberley },
  { type: 'user', id: rp },
  { type: 'user', id: martin },
  { type: 'user', id: arjen },
]

const florenceBEId = { type: 'groupId', id: 'FlorenceBE' } satisfies GroupId;
const florenceFEId = { type: 'groupId', id: 'FlorenceFE' } satisfies GroupId;
const florenceId = { type: 'groupId', id: 'Florence' } satisfies GroupId;
export const groups: UserGroup[] = [
  { type: 'group',
    name: 'FE BE Team',
    id: florenceBEId,
    children: [ rutger, menno ]
  },
  { type: 'group',
    name: 'FE FE',
    id: florenceFEId,
    children: [ kimberley, rp, martin ]
  },
  { type: 'group',
    name: 'FE FE',
    id: florenceId,
    children: [ florenceFEId, florenceBEId, ]
  },
]

const userSelectionData = [
  {
    name: 'r.schoorstra',
    selection: [ rutger ]
  },
  {
    name: 'menno',
    selection: [ menno ]
  },
  {
    name: 'florenceBE',
    selection: [ florenceBEId ]
  },
  {
    name: 'florenceFE',
    selection: [ florenceFEId ]
  },
  {
    name: 'team florence',
    selection: [ florenceBEId, florenceFEId ]
  },
  {
    name: 'arjen',
    selection: [ arjen ]
  },
  {
    name: 'repo: elab',
    selection: [ elabRepo ]
  },
  {
    name: 'repo: BlackLotus',
    selection: [ blackLotusRepo ]
  },
  {
    name: 'repo: db-splitter',
    selection: [ dbSplitterRepo ]
  },
];

export const mockUserSelections: UserSelectionEntry[] = userSelectionData.map((entry, index) => ({
  userSelectionEntryId: `userSelectionEntryId-${index}`,
  ...entry
}));
