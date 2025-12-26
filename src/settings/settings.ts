import { writeFileSync, readFileSync, existsSync } from 'fs';
import { openFileInEditor } from '../utils/open-file';
import { Effect, Schema } from 'effect';
import { appLayer } from '../appLayerRuntime';

const SETTINGS_FILE = 'lazygitlab-settings.json';

// Schema for coercing string|number to number (for user-edited JSON)
const NumberFromStringOrNumber = Schema.transform(
  Schema.Union(Schema.Number, Schema.String),
  Schema.Number,
  {
    decode: (input) => typeof input === 'string' ? Number(input) : input,
    encode: (n) => n
  }
)

const JobImportanceSchema = Schema.Literal('ignore', 'low', 'high')
export type JobImportance = Schema.Schema.Type<typeof JobImportanceSchema>

const NotificationSettingsSchema = Schema.mutable(Schema.Struct({
  enabled: Schema.Boolean,
  lastProcessedEventId: Schema.optional(Schema.String),
}))
export type NotificationSettings = Schema.Schema.Type<typeof NotificationSettingsSchema>

const BackgroundSyncSettingsSchema = Schema.mutable(Schema.Struct({
  enabled: Schema.Boolean,
  syncIntervalSeconds: Schema.Number,
  syncUserSelectionEntryId: Schema.optional(Schema.String),
  lastRefreshTimestamp: Schema.optional(Schema.String),
}))
export type BackgroundSyncSettings = Schema.Schema.Type<typeof BackgroundSyncSettingsSchema>

const SettingsSchema = Schema.mutable(Schema.Struct({
  repositoryPaths: Schema.optionalWith(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.String })), { default: () => ({}) }),
  repositoryColors: Schema.optionalWith(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.String })), { default: () => ({}) }),
  ignoredMergeRequests: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  seenMergeRequests: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  pipelineJobImportance: Schema.optionalWith(
    Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Record({ key: Schema.String, value: JobImportanceSchema })) })),
    { default: () => ({}) }
  ),
  selectedUserSelectionEntryId: Schema.optional(Schema.String),
  currentUser: Schema.optionalWith(Schema.String, { default: () => 'r.schoorstra' }),
  notifications: Schema.optionalWith(NotificationSettingsSchema, { default: () => ({ enabled: false }) }),
  backgroundSync: Schema.optionalWith(BackgroundSyncSettingsSchema, { default: () => ({ enabled: false, syncIntervalSeconds: 60 * 15 }) }),
  jiraBoardId: Schema.optional(NumberFromStringOrNumber),
}))
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

// Decode empty object to get all defaults from schema
const decodeSettings = Schema.decodeUnknownSync(SettingsSchema)
export const defaultSettings: Settings = decodeSettings({})

const allSettingsKeys: (keyof Settings)[] = [
  'repositoryPaths',
  'repositoryColors',
  'ignoredMergeRequests',
  'seenMergeRequests',
  'pipelineJobImportance',
  'selectedUserSelectionEntryId',
  'currentUser',
  'notifications',
  'backgroundSync',
  'jiraBoardId',
];

const serializeSettings = (settings: Settings): string => {
  const obj: Record<string, unknown> = {};
  allSettingsKeys.forEach(key => {
    obj[key] = settings[key] ?? null;
  });
  return JSON.stringify(obj, null, 2);
};

// Color palette for repository colors - Dracula-compatible colors
const REPOSITORY_COLOR_PALETTE = [
  '#ff5555', // Dracula Red
  '#50fa7b', // Dracula Green
  '#8be9fd', // Dracula Cyan
  '#bd93f9', // Dracula Purple
  '#f1fa8c', // Dracula Yellow
  '#ffb86c', // Dracula Orange
  '#ff79c6', // Dracula Pink
  '#8c9ac4', // Dracula Supporting (brighter grey)
  '#6272a4', // Dracula Comment (darker grey-blue)
  '#44475a', // Dracula Current Line (medium grey)
  '#f8f8f2', // Dracula Foreground (white)
  '#282a36', // Dracula Background (dark)
  '#ff6e6e', // Lighter red variant
  '#5af78e', // Lighter green variant
  '#9aedfe', // Lighter cyan variant
  '#caa9fa', // Lighter purple variant
];

// Generate a color for a repository based on its name
const generateRepositoryColor = (repositoryPath: string): string => {
  // Simple hash function to consistently assign colors based on repository path
  let hash = 0;
  for (let i = 0; i < repositoryPath.length; i++) {
    const char = repositoryPath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const colorIndex = Math.abs(hash) % REPOSITORY_COLOR_PALETTE.length;
  return REPOSITORY_COLOR_PALETTE[colorIndex] || '#ff5555';
};

export const modifySettings = (f: (s: Settings) => Settings) => {
  const currentSettings = loadSettings();
  saveSettings(f(currentSettings));
}

export const loadSettings = (): Settings => {
  if (!existsSync(SETTINGS_FILE)) {
    saveSettings(defaultSettings);
    return defaultSettings;
  }

  const fileContent = readFileSync(SETTINGS_FILE, 'utf8');

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse ${SETTINGS_FILE}: ${error instanceof Error ? error.message : error}`);
  }

  return decodeSettings(jsonData);
};

export const saveSettings = (settings: Settings): void => {
  try {
    writeFileSync(SETTINGS_FILE, serializeSettings(settings), 'utf8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

// Ensure repository colors exist for all repositories, generating them if needed
export const ensureRepositoryColors = (repositoryPaths: string[]): Settings => {
  const settings = loadSettings();
  let settingsUpdated = false;

  repositoryPaths.forEach(repoPath => {
    if (!settings.repositoryColors[repoPath]) {
      settings.repositoryColors[repoPath] = generateRepositoryColor(repoPath);
      settingsUpdated = true;
    }
  });

  if (settingsUpdated) {
    saveSettings(settings);
  }

  return settings;
};

export const ensurePipelineJobsInSettings = (mergeRequests: Array<{
  project: { fullPath: string };
  pipeline: { stage: Array<{ jobs: Array<{ name: string }> }> }
}>): Settings => {
  const settings = loadSettings();
  let settingsUpdated = false;

  mergeRequests.forEach(mr => {
    const repoPath = mr.project.fullPath;

    if (!settings.pipelineJobImportance[repoPath]) {
      settings.pipelineJobImportance[repoPath] = {};
      settingsUpdated = true;
    }

    const repoJobs = settings.pipelineJobImportance[repoPath];

    mr.pipeline.stage.forEach(stage => {
      stage.jobs.forEach(job => {
        if (!repoJobs[job.name]) {
          repoJobs[job.name] = 'low';
          settingsUpdated = true;
        }
      });
    });
  });

  if (settingsUpdated) {
    saveSettings(settings);
  }

  return settings;
};

export const openSettingsFile = async (): Promise<void> => {
  if (!existsSync(SETTINGS_FILE)) {
    saveSettings(defaultSettings);
  }

  await openFileInEditor(SETTINGS_FILE).pipe(
    Effect.provide(appLayer),
    Effect.runPromise
  );
};