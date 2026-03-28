export type SettingsUser = { userId: string; gitlab?: string | undefined; bitbucket?: string | undefined; jira?: string | undefined }
export type SettingsGroup = { name: string; id: string; users: string[]; groups: string[] }
export const DEFAULT_USERS: SettingsUser[] = [
  { userId: 'rutger', gitlab: 'r.schoorstra', jira: 'Rutger Schoorstra' },
  { userId: 'menno', gitlab: 'MennoGerbens', jira: 'Menno Gerbens' },
  { userId: 'kimberley', gitlab: 'kimberley', jira: 'Kimberley de Graaf' },
  { userId: 'rp', gitlab: 'Rinze-PieterJonker', jira: 'Rinze-Pieter Jonker' },
  { userId: 'martin', gitlab: 'm.bures', jira: 'Martin Bures' },
  { userId: 'heiner', gitlab: 'h.behrends', jira: 'Heiner Behrends' },
  { userId: 'tomas', gitlab: 'TomasAugustinas', jira: 'Tomas Augustinas' },
  { userId: 'arjen', gitlab: 'ArjenPost', jira: 'Arjen Post' },
  { userId: 'haike', gitlab: 'HaikeZegwaard', jira: 'Haike Zegwaard' },
  { userId: 'chen', gitlab: 'c.zrubavel', jira: 'Chen Zrubavel' },
  { userId: 'harold', gitlab: 'h.harkema', jira: 'Harold Harkema' },
  { userId: 'jelle', gitlab: 'j.becirspahic', jira: 'Jelle Becirspahic' },
  { userId: 'em', gitlab: 'ErickMartijnBouma', jira: 'Erick Martijn Bouma' },
  { userId: 'vic', gitlab: 'VicUlrich', jira: 'Vic Ulrich' },
  { userId: 'max', gitlab: 'm.luppes', jira: 'Max Luppes' },
  { userId: 'georgios', gitlab: 'g.petridis', jira: 'Georgios Petridis' },
]

export const DEFAULT_GROUPS: SettingsGroup[] = [
  { name: 'Florence BE', id: 'FlorenceBE', users: ['rutger', 'menno', 'tomas'], groups: [] },
  { name: 'Florence FE', id: 'FlorenceFE', users: ['kimberley', 'rp', 'martin', 'heiner'], groups: [] },
  { name: 'Erlenmeyer FE', id: 'ErlenmeyerFE', users: ['em', 'jelle', 'haike', 'max', 'georgios'], groups: [] },
  { name: 'Erlenmeyer BE', id: 'ErlenmeyerBE', users: ['harold', 'chen', 'vic', 'arjen'], groups: [] },
]

