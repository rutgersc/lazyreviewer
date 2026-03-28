import { Effect, Stream, Console, Option } from "effect"
import { appAtomRuntime } from "../appLayerRuntime"
import { type NotificationSettings, type BackgroundSyncSettings, type MrSortOrder, defaultSettings, type Settings, SettingsService } from "./settings"
import { type UserSettings, defaultUserSettings, UserSettingsService } from "./user-filter-presets"
import { Atom, AsyncResult } from "effect/unstable/reactivity"
import type { MrGid } from "../domain/identifiers"
import type { UserId, User } from "../userselection/userSelection"
import { settingsUsersToUserSelections } from "../userselection/userSelection"


// Equality helpers for selector atoms
const arrayEquals = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const shallowObjectEquals = <T extends object>(a: T, b: T): boolean => {
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b) as (keyof T)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

// Helper to create a selector atom that only updates when the selected value changes
const selectFromSettings = <T>(
  selector: (settings: Settings) => T,
  defaultValue: T,
  equals: (a: T, b: T) => boolean = Object.is
): Atom.Atom<T> =>
  Atom.make(get => {
    const previous = get.self<T>();
    const newValue = AsyncResult.match(get(settingsAtom), {
      onInitial: () => defaultValue,
      onSuccess: ({ value }) => selector(value),
      onFailure: () => defaultValue
    });
    if (Option.isSome(previous) && equals(previous.value, newValue)) {
      return previous.value;
    }
    return newValue;
  });

export const settingsAtom = appAtomRuntime.atom(
  Stream.unwrap(SettingsService.watchStream),
  { initialValue: defaultSettings }
).pipe(Atom.setLazy(false), Atom.keepAlive)

// Private fn atom for Atom.writable setters to delegate settings writes
const modifySettingsFn = appAtomRuntime.fn((f: (s: Settings) => Settings) =>
  SettingsService.modify(f)
);

// User settings (users, groups, presets) — separate file
export const userSettingsAtom = appAtomRuntime.atom(
  Stream.unwrap(UserSettingsService.watchStream),
  { initialValue: defaultUserSettings }
).pipe(Atom.setLazy(false), Atom.keepAlive)

const selectFromUserSettings = <T>(
  selector: (settings: UserSettings) => T,
  defaultValue: T,
  equals: (a: T, b: T) => boolean = Object.is
): Atom.Atom<T> =>
  Atom.make(get => {
    const previous = get.self<T>();
    const newValue = AsyncResult.match(get(userSettingsAtom), {
      onInitial: () => defaultValue,
      onSuccess: ({ value }) => selector(value),
      onFailure: () => defaultValue
    });
    if (Option.isSome(previous) && equals(previous.value, newValue)) {
      return previous.value;
    }
    return newValue;
  });

// Intermediate selector - only changes when ignoredMergeRequests array changes
const ignoredMergeRequestsRawAtom = selectFromSettings(
  s => s.ignoredMergeRequests,
  [],
  arrayEquals
);

// Consumer atom - only recomputes when the raw atom actually changes
export const ignoredMergeRequestsAtom = Atom.make(get =>
  new Set(get(ignoredMergeRequestsRawAtom))
);

export const toggleIgnoreMergeRequestAtom = appAtomRuntime.fn((mrId: string) =>
  SettingsService.modify(settings => {
    const newIgnored = new Set(settings.ignoredMergeRequests);
    if (newIgnored.has(mrId)) {
      newIgnored.delete(mrId);
    } else {
      newIgnored.add(mrId);
    }
    return { ...settings, ignoredMergeRequests: Array.from(newIgnored) };
  })
);

const seenMergeRequestsRawAtom = selectFromSettings(
  s => s.seenMergeRequests,
  [],
  arrayEquals
);

export const seenMergeRequestsAtom = Atom.make(get =>
  new Set(get(seenMergeRequestsRawAtom))
);

export const toggleSeenMergeRequestAtom = appAtomRuntime.fn((mrId: string) =>
  SettingsService.modify(settings => {
    const newSeen = new Set(settings.seenMergeRequests);
    if (newSeen.has(mrId)) {
      newSeen.delete(mrId);
    } else {
      newSeen.add(mrId);
    }
    return { ...settings, seenMergeRequests: Array.from(newSeen) };
  })
);

// Selected repo paths for syncing
const repoSelectionRawAtom = selectFromSettings(
  s => s.repoSelection,
  [] as string[],
  arrayEquals
);

export const repoSelectionAtom = Atom.writable(
  (get) => get(repoSelectionRawAtom),
  (ctx, newValue: readonly string[]) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, repoSelection: [...newValue] }));
  }
);

// User filter: client-side username filter for MR display
const userFilterUsernamesRawAtom = selectFromSettings(
  s => s.userFilterUsernames,
  [] as string[],
  arrayEquals
);

export const userFilterUsernamesAtom = Atom.writable(
  (get) => get(userFilterUsernamesRawAtom),
  (ctx, newValue: readonly string[]) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, userFilterUsernames: [...newValue] }));
  }
);

// User filter: client-side group filter for MR display
const userFilterGroupIdsRawAtom = selectFromSettings(
  s => s.userFilterGroupIds,
  [] as string[],
  arrayEquals
);

export const userFilterGroupIdsAtom = Atom.writable(
  (get) => get(userFilterGroupIdsRawAtom),
  (ctx, newValue: readonly string[]) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, userFilterGroupIds: [...newValue] }));
  }
);

export const setUserFilterAtom = appAtomRuntime.fn(
  ({ usernames, groupIds }: { usernames: readonly string[]; groupIds: readonly string[] }) =>
    SettingsService.modify(s => ({
      ...s,
      userFilterUsernames: [...usernames],
      userFilterGroupIds: [...groupIds]
    }))
);

const selectedUserSelectionEntryIdRawAtom = selectFromSettings(
  s => s.selectedUserSelectionEntryId,
  undefined as string | undefined
);

export const selectedUserSelectionEntryIdAtom = Atom.writable(
  (get) => get(selectedUserSelectionEntryIdRawAtom),
  (ctx, newValue: string) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, selectedUserSelectionEntryId: newValue }));
  }
);

export const isOnboardingCompleteAtom = Atom.make(get =>
  AsyncResult.match(get(settingsAtom), {
    onInitial: () => true,
    onSuccess: ({ value }) => value.currentUser !== undefined,
    onFailure: () => true,
  })
);

export const currentUserAtom = selectFromSettings(
  s => s.currentUser,
  undefined as string | undefined
);

export const setCurrentUserAtom = Atom.writable(
  (get) => get(currentUserAtom),
  (ctx, newValue: string) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, currentUser: newValue }));
  }
);

export const currentUserIdAtom = Atom.make((get): UserId => {
  const currentUserName = get(currentUserAtom) ?? '';
  const userSettings = AsyncResult.match(get(userSettingsAtom), {
    onInitial: () => defaultUserSettings,
    onSuccess: ({ value }) => value,
    onFailure: () => defaultUserSettings,
  });
  const users = settingsUsersToUserSelections(userSettings.users);
  const found = users
    .filter((u): u is User => u.type === 'user')
    .find(u => u.id.userId === currentUserName || u.id.gitlab === currentUserName || u.id.bitbucket === currentUserName);
  return found?.id ?? { type: 'userId', userId: currentUserName };
});

export const notificationSettingsAtom = selectFromSettings(
  s => s.notifications ?? { enabled: false },
  { enabled: false } as NotificationSettings,
  shallowObjectEquals
);

export const backgroundSyncSettingsAtom = selectFromSettings(
  s => s.backgroundSync ?? { enabled: false, syncIntervalSeconds: 300, scalingFactorHours: 24 },
  { enabled: false, syncIntervalSeconds: 300, scalingFactorHours: 24 } as BackgroundSyncSettings,
  shallowObjectEquals
);

export const toggleNotificationsAtom = appAtomRuntime.fn((_: void) =>
  Effect.gen(function* () {
    const settings = yield* SettingsService.load;
    const enabled = !(settings.notifications?.enabled ?? false);
    yield* SettingsService.modify(s => ({
      ...s,
      notifications: { ...s.notifications, enabled }
    }));
    yield* Console.log(`[Settings] Notifications ${enabled ? 'enabled' : 'disabled'}`);
  })
);

export const toggleBackgroundSyncAtom = appAtomRuntime.fn((_: void) =>
  Effect.gen(function* () {
    const settings = yield* SettingsService.load;
    const enabled = !(settings.backgroundSync?.enabled ?? false);
    yield* SettingsService.modify(s => ({
      ...s,
      backgroundSync: { ...s.backgroundSync!, enabled }
    }));
    yield* Console.log(`[Settings] Background sync ${enabled ? 'enabled' : 'disabled'}`);
  })
);

export const jiraBoardIdAtom = selectFromSettings(
  s => s.jiraBoardId,
  undefined as number | undefined
);

export const setJiraBoardIdAtom = appAtomRuntime.fn((boardId: number | undefined) =>
  SettingsService.modify(s => ({ ...s, jiraBoardId: boardId }))
);

const monitoredMergeRequestsRawAtom = selectFromSettings(
  s => Object.keys(s.monitoredMergeRequests) as MrGid[],
  [] as MrGid[],
  arrayEquals
);

export const monitoredMergeRequestsAtom = Atom.make(get =>
  new Set(get(monitoredMergeRequestsRawAtom))
);

export const toggleMonitorMergeRequestAtom = appAtomRuntime.fn((mrGid: MrGid) =>
  SettingsService.modify(settings => {
    const current = { ...settings.monitoredMergeRequests };
    if (mrGid in current) {
      delete current[mrGid];
    } else {
      current[mrGid] = { jobStates: {} };
    }
    return { ...settings, monitoredMergeRequests: current };
  })
);

const cycleJobImportance = (current: string): 'low' | 'monitored' | 'ignore' => {
  switch (current) {
    case 'low': return 'monitored';
    case 'monitored': return 'ignore';
    default: return 'low';
  }
};

export const toggleJobImportanceAtom = appAtomRuntime.fn(
  ({ projectFullPath, jobName }: { projectFullPath: string; jobName: string }) =>
    SettingsService.modify(settings => {
      const projectJobs = { ...settings.pipelineJobImportance };
      const jobs = { ...(projectJobs[projectFullPath] ?? {}) };
      jobs[jobName] = cycleJobImportance(jobs[jobName] ?? 'low');
      projectJobs[projectFullPath] = jobs;
      return { ...settings, pipelineJobImportance: projectJobs };
    })
);

const pipelineJobImportanceRawAtom = selectFromSettings(
  s => s.pipelineJobImportance,
  {} as Record<string, Record<string, string>>,
  shallowObjectEquals
);

export const pipelineJobImportanceAtom = Atom.make(get => {
  const raw = get(pipelineJobImportanceRawAtom);
  return new Map(
    Object.entries(raw).map(([project, jobs]) => [project, new Map(Object.entries(jobs))])
  );
});

export const repositoryColorsAtom = selectFromSettings(
  s => s.repositoryColors,
  {} as Record<string, string>,
  shallowObjectEquals
);

export const repositoryPathsAtom = selectFromSettings(
  s => s.repositoryPaths,
  {} as Record<string, { localPath: string; remoteName: string }>,
  shallowObjectEquals
);

export const ensureRepositoryPathsAtom = appAtomRuntime.fn((repoPaths: readonly string[]) =>
  SettingsService.modify(s => {
    const updated = { ...s.repositoryPaths }
    let changed = false
    for (const path of repoPaths) {
      if (!(path in updated)) {
        updated[path] = { localPath: '', remoteName: 'origin' }
        changed = true
      }
    }
    return changed ? { ...s, repositoryPaths: updated } : s
  })
);

export type CompleteOnboardingParams = {
  readonly repoPaths: readonly string[]
  readonly currentUser: string
  readonly selectedUserSelectionEntryId: string
  readonly repositoryLocalPaths: ReadonlyMap<string, string>
}

export const completeOnboardingAtom = appAtomRuntime.fn((params: CompleteOnboardingParams) =>
  SettingsService.modify(s => {
    const repositoryPaths = { ...s.repositoryPaths }
    for (const path of params.repoPaths) {
      const localPath = params.repositoryLocalPaths.get(path) ?? ''
      repositoryPaths[path] = {
        localPath,
        remoteName: repositoryPaths[path]?.remoteName ?? 'origin',
      }
    }
    return {
      ...s,
      repoSelection: [...params.repoPaths],
      repositoryPaths,
      currentUser: params.currentUser,
      selectedUserSelectionEntryId: params.selectedUserSelectionEntryId,
    }
  })
);

const mrSortOrderRawAtom = selectFromSettings(
  s => s.mrSortOrder ?? 'updatedAt',
  'updatedAt' as MrSortOrder
);

export const mrSortOrderAtom = Atom.writable(
  (get) => get(mrSortOrderRawAtom),
  (ctx, newValue: MrSortOrder) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, mrSortOrder: newValue }));
  }
);

export type SprintFilter = { id: number; name: string };

const sprintFilterEquals = (a: SprintFilter | null, b: SprintFilter | null): boolean =>
  a === b || (a !== null && b !== null && a.id === b.id && a.name === b.name);

export const sprintFilterAtom = selectFromSettings(
  (s): SprintFilter | null =>
    s.sprintFilterId !== undefined && s.sprintFilterName !== undefined
      ? { id: s.sprintFilterId, name: s.sprintFilterName }
      : null,
  null as SprintFilter | null,
  sprintFilterEquals
);

export const setSprintFilterAtom = appAtomRuntime.fn((filter: SprintFilter | null) =>
  SettingsService.modify(s => ({
    ...s,
    sprintFilterId: filter?.id,
    sprintFilterName: filter?.name,
  }))
);

export type AppView = 'review' | 'focus'

const appViewRawAtom = selectFromSettings(
  s => s.appView ?? 'review',
  'review' as AppView
);

export const appViewAtom = Atom.writable(
  (get) => get(appViewRawAtom),
  (ctx, newValue: AppView) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, appView: newValue }));
  }
);

const factsSelectionActiveRawAtom = selectFromSettings(
  s => s.factsSelectionActive ?? false,
  false
);

export const factsSelectionActiveAtom = Atom.writable(
  (get) => get(factsSelectionActiveRawAtom),
  (ctx, newValue: boolean) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, factsSelectionActive: newValue }));
  }
);

export type FactsViewStyle = 'grouped' | 'chronological'

const factsViewStyleRawAtom = selectFromSettings(
  s => s.factsViewStyle ?? 'chronological',
  'chronological' as FactsViewStyle
);

export const factsViewStyleAtom = Atom.writable(
  (get) => get(factsViewStyleRawAtom),
  (ctx, newValue: FactsViewStyle) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, factsViewStyle: newValue }));
  }
);

// User groups
import type { SettingsGroup } from '../data/default-users-and-groups'

const groupsEquals = (a: readonly SettingsGroup[], b: readonly SettingsGroup[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((g, i) => g.id === b[i]?.id && g.name === b[i]?.name);
};

export const userGroupsAtom = selectFromUserSettings(
  s => s.userGroups,
  [] as SettingsGroup[],
  groupsEquals
);

export const saveGroupAtom = appAtomRuntime.fn(
  ({ name, users, groups }: { name: string; users: readonly string[]; groups: readonly string[] }) =>
    UserSettingsService.modify(s => ({
      ...s,
      userGroups: [...s.userGroups, {
        id: `group-${Date.now()}`,
        name,
        users: [...users],
        groups: [...groups],
      }],
    }))
);

export const updateGroupAtom = appAtomRuntime.fn(
  ({ id, name, users, groups }: { id: string; name: string; users: readonly string[]; groups: readonly string[] }) =>
    UserSettingsService.modify(s => ({
      ...s,
      userGroups: s.userGroups.map(g =>
        g.id === id ? { id, name, users: [...users], groups: [...groups] } : g
      ),
    }))
);

export const deleteGroupAtom = appAtomRuntime.fn(
  (groupId: string) =>
    UserSettingsService.modify(s => ({
      ...s,
      userGroups: s.userGroups.filter(g => g.id !== groupId),
    }))
);

export const moveGroupAtom = appAtomRuntime.fn(
  ({ groupId, direction }: { groupId: string; direction: 'up' | 'down' }) =>
    UserSettingsService.modify(s => {
      const idx = s.userGroups.findIndex(g => g.id === groupId);
      if (idx < 0) return s;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= s.userGroups.length) return s;
      const reordered = [...s.userGroups];
      [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx]!, reordered[idx]!];
      return { ...s, userGroups: reordered };
    })
);

export const saveGroupsFromOnboardingAtom = appAtomRuntime.fn(
  (groups: readonly SettingsGroup[]) =>
    UserSettingsService.modify(s => ({
      ...s,
      userGroups: [...groups],
    }))
);

