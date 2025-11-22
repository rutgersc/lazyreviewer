import { FileSystem } from "@effect/platform"
import { Effect, Stream, Console } from "effect"
import { appAtomRuntime } from "../appLayerRuntime"
import { type Settings, defaultSettings, loadSettings, saveSettings } from "./settings"
import { Atom, Result } from "@effect-atom/atom-react"

const SETTINGS_FILE = 'lazygitlab-settings.json';

const watchSettingsStream = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  const readFile = fs.readFileString(SETTINGS_FILE).pipe(
    Effect.map((content) => JSON.parse(content) as Settings),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error("Failed to read settings:", error);
        return defaultSettings;
      })
    )
  );

  const initial = yield* readFile;

  const watchStream = fs.watch(SETTINGS_FILE).pipe(
    Stream.debounce("100 millis"),
    Stream.mapEffect(() => readFile),
    // Stream.catchAll((error) => {
    //   return Stream.fromEffect(Console.error("Settings watch error:", error));
    // })
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

    settings.ignoredMergeRequests = Array.from(newSeen);
    saveSettings(settings);
  })
);

export const selectedUserSelectionEntryAtom = Atom.writable(
  (get) => {
    return Result.match(get(settingsAtom), {
      onInitial: () => 0,
      onSuccess: ({ value }) => value.selectedUserSelectionEntry,
      onFailure: () => 0
    });
  },
  (ctx, newValue: number) => {
    const settings = loadSettings();
    settings.selectedUserSelectionEntry = newValue;
    saveSettings(settings);
  }
);


