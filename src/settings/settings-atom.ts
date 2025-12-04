import { FileSystem } from "@effect/platform"
import { Effect, Stream, Console } from "effect"
import { appAtomRuntime } from "../appLayerRuntime"
import { type Settings, defaultSettings, loadSettings, saveSettings } from "./settings"
import { Atom, Result } from "@effect-atom/atom-react"

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
    } catch {
      return defaultSettings;
    }
  };

  const initialContent = yield* readFileContent;
  const initial = parseContent(initialContent);

  const watchStream = fs.watch(SETTINGS_FILE).pipe(
    Stream.tap(() => Effect.sync(() => console.log("[Settings] File watch event fired"))),
    Stream.debounce("100 millis"),
    Stream.mapEffect(() => readFileContent),
    Stream.changes,
    Stream.tap((content) => Effect.sync(() => {
      console.log("[Settings] File content actually changed at", new Date().toISOString());
    })),
    Stream.map(parseContent)
  );

  return Stream.concat(Stream.make(initial), watchStream);
});

export const settingsAtom = appAtomRuntime.atom(
  Stream.unwrap(watchSettingsStream),
  { initialValue: defaultSettings }
).pipe(Atom.setLazy(false), Atom.keepAlive)

export const ignoredMergeRequestsAtom = Atom.make(get => {
  return Result.match(get(settingsAtom), {
    onInitial: () => new Set<string>(),
    onSuccess: ({ value }) => new Set<string>(value.ignoredMergeRequests),
    onFailure: () => new Set<string>()
  });
});

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

export const seenMergeRequestsAtom = Atom.make(get => {
  return Result.match(get(settingsAtom), {
    onInitial: () => new Set<string>(),
    onSuccess: ({ value }) => new Set<string>(value.seenMergeRequests),
    onFailure: () => new Set<string>()
  });
});

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

export const selectedUserSelectionEntryIdAtom = Atom.writable(
  (get) => {
    return Result.match(get(settingsAtom), {
      onInitial: () => undefined,
      onSuccess: ({ value }) => value.selectedUserSelectionEntryId,
      onFailure: () => undefined
    });
  },
  (ctx, newValue: string | undefined) => {
    const settings = loadSettings();
    console.log("selectedUserSelectionEntryIdAtom set", newValue);
    settings.selectedUserSelectionEntryId = newValue;
    saveSettings(settings);
  }
);

export const currentUserAtom = Atom.make(get => {
  return Result.match(get(settingsAtom), {
    onInitial: () => 'r.schoorstra',
    onSuccess: ({ value }) => value.currentUser,
    onFailure: () => 'r.schoorstra'
  });
});

export const notificationSettingsAtom = Atom.make(get => {
  return Result.match(get(settingsAtom), {
    onInitial: () => ({ enabled: false, syncIntervalSeconds: 60 * 10 }),
    onSuccess: ({ value }) => value.notifications ?? { enabled: false, syncIntervalSeconds: 60 * 10 },
    onFailure: () => ({ enabled: false, syncIntervalSeconds: 60 * 10 })
  });
});

export const toggleNotificationsAtom = appAtomRuntime.fn((_: void, get) =>
  Effect.gen(function* () {
    const settings = loadSettings();
    if (!settings.notifications) {
      settings.notifications = { enabled: false, syncIntervalSeconds: 120 };
    }
    settings.notifications.enabled = !settings.notifications.enabled;
    saveSettings(settings);
    yield* Console.log(`[Settings] Notifications ${settings.notifications.enabled ? 'enabled' : 'disabled'}`);
  })
);
