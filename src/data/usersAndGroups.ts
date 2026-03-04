import type { GroupId, UserGroup, UserId, UserSelection, UserSelectionEntry } from '../userselection/userSelection';

// TODO: Replace jira values with actual Jira accountIds (one-time lookup)
const rutger = { type: 'userId', userId: 'rutger', gitlab: 'r.schoorstra', jira: 'Rutger Schoorstra' } satisfies UserId;
const menno = { type: 'userId', userId: 'menno', gitlab: 'MennoGerbens', jira: 'Menno Gerbens' } satisfies UserId;
const kimberley = { type: 'userId', userId: 'kimberley', gitlab: 'kimberley', jira: 'Kimberley de Graaf' } satisfies UserId;
const rp = { type: 'userId', userId: 'rp', gitlab: 'Rinze-PieterJonker', jira: 'Rinze-Pieter Jonker' } satisfies UserId;
const martin = { type: 'userId', userId: 'martin', gitlab: 'm.bures', jira: 'Martin Bures' } satisfies UserId;
const heiner = { type: 'userId', userId: 'heiner', gitlab: 'h.behrends', jira: 'Heiner Behrends' } satisfies UserId;
const tomas = { type: 'userId', userId: 'tomas', gitlab: 'TomasAugustinas', jira: 'Tomas Augustinas' } satisfies UserId;
const arjen = { type: 'userId', userId: 'arjen', gitlab: 'ArjenPost', jira: 'Arjen Post' } satisfies UserId;
const haike = { type: 'userId', userId: 'haike', gitlab: 'HaikeZegwaard', jira: 'Haike Zegwaard' } satisfies UserId;
const chen = { type: 'userId', userId: 'chen', gitlab: 'c.zrubavel', jira: 'Chen Zrubavel' } satisfies UserId;
const harold = { type: 'userId', userId: 'harold', gitlab: 'h.harkema', jira: 'Harold Harkema' } satisfies UserId;
const jelle = { type: 'userId', userId: 'jelle', gitlab: 'j.becirspahic', jira: 'Jelle Becirspahic' } satisfies UserId;
const erickmartijn = { type: 'userId', userId: 'em', gitlab: 'ErickMartijnBouma', jira: 'Erick Martijn Bouma' } satisfies UserId;
const vic = { type: 'userId', userId: 'vic', gitlab: 'VicUlrich', jira: 'Vic Ulrich' } satisfies UserId;
const max = { type: 'userId', userId: 'max', gitlab: 'm.luppes', jira: 'Max Luppes' } satisfies UserId;
const george = { type: 'userId', userId: 'georgios', gitlab: 'g.petridis', jira: 'Georgios Petridis' } satisfies UserId;

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
  { type: 'user', id: haike },
  { type: 'user', id: jelle },
  { type: 'user', id: erickmartijn },
  { type: 'user', id: max },
  { type: 'user', id: george },
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
  { type: 'group',
    name: 'Erlenmeyer FE',
    id: erlenmeyerFEId,
    children: [ erickmartijn, jelle, haike, max, george ]
  },
  { type: 'group',
    name: 'Erlenmeyer BE',
    id: erlenmeyerBEId,
    children: [ harold, chen, vic, arjen ]
  },
  { type: 'group',
    name: 'Erlenmeyer',
    id: erlenmeyerId,
    children: [ erlenmeyerFEId, erlenmeyerBEId ]
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
