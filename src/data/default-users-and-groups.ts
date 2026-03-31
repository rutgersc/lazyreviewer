export type SettingsUser = { userId: string; gitlab?: string | undefined; bitbucket?: string | undefined; jira?: string | undefined }
export type SettingsGroup = { name: string; id: string; users: string[]; groups: string[] }
export const DEFAULT_USERS: SettingsUser[] = []
export const DEFAULT_GROUPS: SettingsGroup[] = []
