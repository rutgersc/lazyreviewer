import { Effect } from "effect";
import { loadSettings, saveSettings, type Settings } from "../settings/settings";

export class SettingsService {
  static readonly tag = "SettingsService";

  static load = Effect.gen(function* () {
    return loadSettings();
  });

  static save = (settings: Settings) => Effect.gen(function* () {
    saveSettings(settings);
    return settings;
  });

  static updateIgnoredMergeRequests = (ignoredMergeRequests: string[]) => 
    Effect.gen(function* () {
      const settings = yield* SettingsService.load;
      const updatedSettings = { ...settings, ignoredMergeRequests };
      return yield* SettingsService.save(updatedSettings);
    });

  static updateSeenMergeRequests = (seenMergeRequests: string[]) => 
    Effect.gen(function* () {
      const settings = yield* SettingsService.load;
      const updatedSettings = { ...settings, seenMergeRequests };
      return yield* SettingsService.save(updatedSettings);
    });
}
