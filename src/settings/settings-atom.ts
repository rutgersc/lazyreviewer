import { FileSystem } from "@effect/platform"
import { Effect, Stream, Console, Option } from "effect"
import { appAtomRuntime } from "../appLayerRuntime"
import { type NotificationSettings, type BackgroundSyncSettings, type MonitoredMrCompletedReason, defaultSettings, loadSettings, saveSettings, Settings } from "./settings"
import { Atom, Result } from "@effect-atom/atom-react"
import type { MrGid } from "../gitlab/gitlab-schema"

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

const SETTINGS_FILE = 'lazygitlab-settings.json';

const watchSettingsStream = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  const readFileContent = fs.readFileString(SETTINGS_FILE).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error("Failed to read settings:", error);
        return JSON.stringify(defaultSettings);
      })
    )
  );

  const parseContent = (content: string): Settings => {
    try {
      return JSON.parse(content) as Settings;
    } catch (error) {
      throw new Error(`Failed to parse ${SETTINGS_FILE}: ${error instanceof Error ? error.message : error}`);
    }
  };

  const initialContent = yield* readFileContent;
  const initial = parseContent(initialContent);

  const watchStream = fs.watch(SETTINGS_FILE).pipe(
    Stream.debounce("100 millis"),
    Stream.mapEffect(() => readFileContent),
    Stream.changes,
    Stream.map(parseContent)
  );

  return Stream.concat(Stream.make(initial), watchStream);
});

export const settingsAtom = appAtomRuntime.atom(
  Stream.unwrap(watchSettingsStream),
  { initialValue: defaultSettings }
).pipe(Atom.setLazy(false), Atom.keepAlive)

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

export const toggleIgnoreMergeRequestAtom = appAtomRuntime.fn((mrId: string, get) =>
  Effect.gen(function* () {
    const settings = loadSettings();
    const newIgnored = new Set(settings.ignoredMergeRequests);

    if (newIgnored.has(mrId)) {
      newIgnored.delete(mrId);
    } else {
      newIgnored.add(mrId);
    }

    settings.ignoredMergeRequests = Array.from(newIgnored);
    saveSettings(settings);
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

export const toggleSeenMergeRequestAtom = appAtomRuntime.fn((mrId: string, get) =>
  Effect.gen(function* () {
    const settings = loadSettings();
    const newSeen = new Set(settings.seenMergeRequests);
    if (newSeen.has(mrId)) {
      newSeen.delete(mrId);
    } else {
      newSeen.add(mrId);
    }

    console.log("toggleSeenMergeRequestAtom", { seenMergeRequests: settings.seenMergeRequests, newSeen })

    settings.seenMergeRequests = Array.from(newSeen);
    saveSettings(settings);
  })
);

const selectedUserSelectionEntryIdRawAtom = selectFromSettings(
  s => s.selectedUserSelectionEntryId,
  undefined as string | undefined
);

export const selectedUserSelectionEntryIdAtom = Atom.writable(
  (get) => get(selectedUserSelectionEntryIdRawAtom),
  (ctx, newValue: string | undefined) => {
    const settings = loadSettings();
    console.log("selectedUserSelectionEntryIdAtom set", newValue);
    settings.selectedUserSelectionEntryId = newValue;
    saveSettings(settings);
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

export const toggleNotificationsAtom = appAtomRuntime.fn((_: void, get) =>
  Effect.gen(function* () {
    const settings = loadSettings();
    if (!settings.notifications) {
      settings.notifications = { enabled: false };
    }
    settings.notifications.enabled = !settings.notifications.enabled;
    saveSettings(settings);
    yield* Console.log(`[Settings] Notifications ${settings.notifications.enabled ? 'enabled' : 'disabled'}`);
  })
);

export const jiraBoardIdAtom = selectFromSettings(
  s => s.jiraBoardId,
  undefined as number | undefined
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
  Effect.gen(function* () {
    Settings.toggleMonitorMergeRequest(mrGid);
  })
);

export const clearCompletedMonitoredMrsAtom = appAtomRuntime.fn(() =>
  Effect.gen(function* () {
    Settings.clearCompletedMonitoredMrs();
  })
);

const projectMonitoredJobsRawAtom = selectFromSettings(
  s => s.projectMonitoredJobs,
  {} as Record<string, string[]>,
  shallowObjectEquals
);

export const projectMonitoredJobsAtom = Atom.make(get => {
  const raw = get(projectMonitoredJobsRawAtom);
  return new Map(
    Object.entries(raw).map(([project, jobs]) => [project, new Set(jobs)])
  );
});

export const toggleMonitorJobAtom = appAtomRuntime.fn(
  ({ projectFullPath, jobName }: { projectFullPath: string; jobName: string }) =>
    Effect.gen(function* () {
      const settings = loadSettings();
      const currentJobs = new Set(settings.projectMonitoredJobs[projectFullPath] ?? []);

      if (currentJobs.has(jobName)) {
        currentJobs.delete(jobName);
      } else {
        currentJobs.add(jobName);
      }

      settings.projectMonitoredJobs[projectFullPath] = Array.from(currentJobs);
      saveSettings(settings);
    })
);

export const toggleJobImportanceAtom = appAtomRuntime.fn(
  ({ projectFullPath, jobName }: { projectFullPath: string; jobName: string }) =>
    Effect.gen(function* () {
      const settings = loadSettings();
      const projectJobs = (settings.pipelineJobImportance[projectFullPath] ??= {});
      const currentImportance = projectJobs[jobName] ?? 'low';
      projectJobs[jobName] = currentImportance === 'high' ? 'low' : 'high';
      saveSettings(settings);
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
