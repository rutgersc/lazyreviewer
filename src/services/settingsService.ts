import { Effect } from "effect";
import { loadSettings, saveSettings, type Settings } from "../settings/settings";

export class SettingsService extends Effect.Service<SettingsService>()("SettingsService", {
  effect: Effect.gen(function* () {
    return {
      load: Effect.sync(() => loadSettings()),
      save: (settings: Settings) => Effect.sync(() => {
        saveSettings(settings);
        return settings;
      }),
      updateIgnoredMergeRequests: (ignoredMergeRequests: string[]) =>
        Effect.sync(() => {
          const current = loadSettings();
          const updated: Settings = { ...current, ignoredMergeRequests };
          saveSettings(updated);
          return updated;
        }),
      updateSeenMergeRequests: (seenMergeRequests: string[]) =>
        Effect.sync(() => {
          const current = loadSettings();
          const updated: Settings = { ...current, seenMergeRequests };
          saveSettings(updated);
          return updated;
        }),
    } as const;
  })
}) {}
