import type { GroupId, UserGroup, UserId, UserSelection, UserSelectionEntry, RepositoryId } from '../userselection/userSelection';

const rutger = { type: 'userId', id: 'r.schoorstra'  } satisfies UserId;
const menno = { type: 'userId', id: 'MennoGerbens'  } satisfies UserId;
const kimberley = { type: 'userId', id: 'kimberley'  } satisfies UserId;
const rp = { type: 'userId', id: 'Rinze-PieterJonker'  } satisfies UserId;
const martin = { type: 'userId', id: 'm.bures'  } satisfies UserId;
const heiner = { type: 'userId', id: 'h.behrends'  } satisfies UserId;
const arjen = { type: 'userId', id: 'ArjenPost'  } satisfies UserId;
const chen = { type: 'userId', id: 'c.zrubavel'  } satisfies UserId;
const harold = { type: 'userId', id: 'h.harkema'  } satisfies UserId;
const vic = { type: 'userId', id: 'VicUlrich'  } satisfies UserId;

const elabRepo = { type: 'repositoryId', id: 'elab/elab'  } satisfies RepositoryId;
const blackLotusRepo = { type: 'repositoryId', id: 'elab/BlackLotus'  } satisfies RepositoryId;
const dbSplitterRepo = { type: 'repositoryId', id: 'elab/db-splitter'  } satisfies RepositoryId;
const bitbucketCoreIamRepo = { type: 'repositoryId', id: 'bitbucket:raftdev/core.iam'  } satisfies RepositoryId;
export const users: UserSelection[] = [
  { type: 'user', id: rutger },
  { type: 'user', id: heiner },
  { type: 'user', id: menno },
  { type: 'user', id: kimberley },
  { type: 'user', id: rp },
  { type: 'user', id: martin },
  { type: 'user', id: arjen },
  { type: 'user', id: chen },
  { type: 'user', id: harold },
  { type: 'user', id: vic },
]

const florenceBEId = { type: 'groupId', id: 'FlorenceBE' } satisfies GroupId;
const florenceFEId = { type: 'groupId', id: 'FlorenceFE' } satisfies GroupId;
const florenceId = { type: 'groupId', id: 'Florence' } satisfies GroupId;

const erlenmeyerFEId = { type: 'groupId', id: 'ErlenmeyerFE' } satisfies GroupId;
const erlenmeyerBEId = { type: 'groupId', id: 'ErlenmeyerBE' } satisfies GroupId;
const erlenmeyerId = { type: 'groupId', id: 'Erlenmeyer' } satisfies GroupId;

export const groups: UserGroup[] = [
  { type: 'group',
    name: 'Florence BE',
    id: florenceBEId,
    children: [ rutger, menno ]
  },
  { type: 'group',
    name: 'Florence FE',
    id: florenceFEId,
    children: [ kimberley, rp, martin, heiner ]
  },
  { type: 'group',
    name: 'Florence',
    id: florenceId,
    children: [ florenceFEId, florenceBEId, ]
  },
  // { type: 'group',
  //   name: 'Erlenmeyer FE',
  //   id: erlenmeyerFEId,
  //   children: [  ]
  // },
  { type: 'group',
    name: 'Erlenmeyer BE',
    id: erlenmeyerBEId,
    children: [ harold, chen, vic ]
  },
]

const userSelectionData = [
  {
    name: 'r.schoorstra',
    selection: [ rutger ]
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
    name: 'erlenmeyerBE',
    selection: [ erlenmeyerBEId ]
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
  {
    name: 'bitbucket: raftdev/core.iam',
    selection: [ bitbucketCoreIamRepo ]
  },
];

export const mockUserSelections: UserSelectionEntry[] = userSelectionData.map((entry, index) => ({
  userSelectionEntryId: `userSelectionEntryId-${index}`,
  ...entry
}));
