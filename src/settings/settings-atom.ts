import { Effect, Stream, Console, Option } from "effect"
import { appAtomRuntime } from "../appLayerRuntime"
import { type NotificationSettings, type BackgroundSyncSettings, type MonitoredMrCompletedReason, type MrSortOrder, defaultSettings, type Settings, SettingsService } from "./settings"
import { Atom, Result } from "@effect-atom/atom-react"
import type { MrGid } from "../domain/identifiers"

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
    const newValue = Result.match(get(settingsAtom), {
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

const selectedUserSelectionEntryIdRawAtom = selectFromSettings(
  s => s.selectedUserSelectionEntryId,
  undefined as string | undefined
);

export const selectedUserSelectionEntryIdAtom = Atom.writable(
  (get) => get(selectedUserSelectionEntryIdRawAtom),
  (ctx, newValue: string | undefined) => {
    ctx.set(modifySettingsFn, (s: Settings) => ({ ...s, selectedUserSelectionEntryId: newValue }));
  }
);

export const currentUserAtom = selectFromSettings(
  s => s.currentUser,
  'r.schoorstra'
);

export const notificationSettingsAtom = selectFromSettings(
  s => s.notifications ?? { enabled: false },
  { enabled: false } as NotificationSettings,
  shallowObjectEquals
);

export const backgroundSyncSettingsAtom = selectFromSettings(
  s => s.backgroundSync ?? { enabled: false, syncIntervalSeconds: 60 * 15 },
  { enabled: false, syncIntervalSeconds: 60 * 15 } as BackgroundSyncSettings,
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

export const monitoredMrStatesAtom = selectFromSettings(
  s => new Map(
    Object.entries(s.monitoredMergeRequests).map(
      ([gid, state]) => [gid as MrGid, state.completedReason] as const
    )
  ),
  new Map<MrGid, MonitoredMrCompletedReason | undefined>(),
  (a, b) => {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (b.get(key) !== val) return false;
    }
    return true;
  }
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

export const clearCompletedMonitoredMrsAtom = appAtomRuntime.fn(() =>
  SettingsService.modify(settings => ({
    ...settings,
    monitoredMergeRequests: Object.fromEntries(
      Object.entries(settings.monitoredMergeRequests)
        .filter(([, state]) => !state.completedReason)
    ) as typeof settings.monitoredMergeRequests
  }))
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
