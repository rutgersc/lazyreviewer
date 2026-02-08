import type { GroupId, UserGroup, UserId, UserSelection, UserSelectionEntry } from '../userselection/userSelection';

const rutger = { type: 'userId', name: 'rutger', gitlab: 'r.schoorstra', jira: { displayName: 'Rutger Schoorstra' } } satisfies UserId;
const menno = { type: 'userId', name: 'menno', gitlab: 'MennoGerbens', jira: { displayName: 'Menno Gerbens' } } satisfies UserId;
const kimberley = { type: 'userId', name: 'kimberley', gitlab: 'kimberley', jira: { displayName: 'Kimberley de Graaf' } } satisfies UserId;
const rp = { type: 'userId', name: 'rp', gitlab: 'Rinze-PieterJonker', jira: { displayName: 'Rinze-Pieter Jonker' } } satisfies UserId;
const martin = { type: 'userId', name: 'martin', gitlab: 'm.bures', jira: { displayName: 'Martin Bures' } } satisfies UserId;
const heiner = { type: 'userId', name: 'heiner', gitlab: 'h.behrends', jira: { displayName: 'Heiner Behrends' } } satisfies UserId;
const tomas = { type: 'userId', name: 'tomas', gitlab: 'TomasAugustinas', jira: { displayName: 'Tomas Augustinas' } } satisfies UserId;
const arjen = { type: 'userId', name: 'arjen', gitlab: 'ArjenPost', jira: { displayName: 'Arjen Post' } } satisfies UserId;
const haike = { type: 'userId', name: 'haike', gitlab: 'HaikeZegwaard', jira: { displayName: 'Haike Zegwaard' } } satisfies UserId;
const chen = { type: 'userId', name: 'chen', gitlab: 'c.zrubavel', jira: { displayName: 'Chen Zrubavel' } } satisfies UserId;
const harold = { type: 'userId', name: 'harold', gitlab: 'h.harkema', jira: { displayName: 'Harold Harkema' } } satisfies UserId;
const vic = { type: 'userId', name: 'vic', gitlab: 'VicUlrich', jira: { displayName: 'Vic Ulrich' } } satisfies UserId;

export const users: UserSelection[] = [
  { type: 'user', id: rutger },
  { type: 'user', id: heiner },
  { type: 'user', id: menno },
  { type: 'user', id: kimberley },
  { type: 'user', id: rp },
  { type: 'user', id: martin },
  { type: 'user', id: tomas },
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
    children: [ rutger, menno, tomas ]
  },
  { type: 'group',
    name: 'Florence FE',
    id: florenceFEId,
    children: [ kimberley, rp, martin, heiner ]
  },
  { type: 'group',
    name: 'Florence',
    id: florenceId,
    children: [ florenceFEId, florenceBEId ]
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
    name: 'menno',
    selection: [ menno ]
  },
  {
    name: 'tomas',
    selection: [ tomas ]
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
    name: 'haike',
    selection: [ haike ]
  },
];

export const mockUserSelections: UserSelectionEntry[] = userSelectionData.map((entry, index) => ({
  userSelectionEntryId: `userSelectionEntryId-${entry.name}`,
  ...entry
}));
