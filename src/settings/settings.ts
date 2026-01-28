import { writeFileSync, readFileSync, existsSync } from 'fs';
import { openFileInEditor } from '../utils/open-file';
import { Effect, Schema } from 'effect';
import { appLayer } from '../appLayerRuntime';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { MrGid, PipelineJobSchema } from '../gitlab/gitlab-schema';

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

const JobImportanceSchema = Schema.Literal('ignore', 'low', 'monitored')
export type JobImportance = Schema.Schema.Type<typeof JobImportanceSchema>

const JobImportanceWithMigration = Schema.transform(
  Schema.Union(Schema.Literal('ignore', 'low', 'monitored', 'high', 'hidden'), Schema.String),
  JobImportanceSchema,
  {
    strict: true,
    decode: (input) => {
      if (input === 'high') return 'monitored';
      if (input === 'hidden') return 'ignore';
      if (input === 'ignore' || input === 'low' || input === 'monitored') return input;
      return 'low';
    },
    encode: (output) => output
  }
)

const MrSortOrderSchema = Schema.Literal('updatedAt', 'createdAt')
export type MrSortOrder = Schema.Schema.Type<typeof MrSortOrderSchema>

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

// Repository path configuration schema
const RepositoryPathConfigSchema = Schema.mutable(Schema.Struct({
  localPath: Schema.String,
  remoteName: Schema.optionalWith(Schema.String, { default: () => 'origin' })
}))
export type RepositoryPathConfig = Schema.Schema.Type<typeof RepositoryPathConfigSchema>

// Transform for backward compatibility: string -> object, object -> object
const RepositoryPathConfigWithMigration = Schema.transform(
  Schema.Union(Schema.String, RepositoryPathConfigSchema),
  RepositoryPathConfigSchema,
  {
    strict: true,
    decode: (input) => typeof input === 'string'
      ? { localPath: input, remoteName: 'origin' }
      : input,
    encode: (output) => ({ localPath: output.localPath, remoteName: output.remoteName ?? 'origin' })
  }
)

const MonitoredMrCompletedReasonSchema = Schema.Literal('merged', 'closed')
export type MonitoredMrCompletedReason = Schema.Schema.Type<typeof MonitoredMrCompletedReasonSchema>

const MonitoredMrStateSchema = Schema.mutable(Schema.Struct({
  pipelineIid: Schema.optional(Schema.String),
  jobStates: Schema.optionalWith(
    Schema.mutable(Schema.Record({
      key: Schema.String,
      value: PipelineJobSchema.fields.status
    })),
    { default: () => ({}) }
  ),
  lastCommit: Schema.optional(Schema.String),
  completedReason: Schema.optional(MonitoredMrCompletedReasonSchema)
}))
export type MonitoredMrState = Schema.Schema.Type<typeof MonitoredMrStateSchema>

export const SettingsSchema = Schema.mutable(Schema.Struct({
  repositoryPaths: Schema.optionalWith(Schema.mutable(Schema.Record({ key: Schema.String, value: RepositoryPathConfigWithMigration })), { default: () => ({}) }),
  repositoryColors: Schema.optionalWith(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.String })), { default: () => ({}) }),
  ignoredMergeRequests: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  seenMergeRequests: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  monitoredMergeRequests: Schema.optionalWith(
    Schema.mutable(Schema.Record({
      key: Schema.String.pipe(Schema.fromBrand(MrGid)),
      value: MonitoredMrStateSchema
    })),
    { default: () => ({}) }
  ),
  projectMonitoredJobs: Schema.optionalWith(
    Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Array(Schema.String)) })),
    { default: () => ({}) }
  ),
  pipelineJobImportance: Schema.optionalWith(
    Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Record({ key: Schema.String, value: JobImportanceWithMigration })) })),
    { default: () => ({}) }
  ),
  selectedUserSelectionEntryId: Schema.optional(Schema.String),
  currentUser: Schema.optionalWith(Schema.String, { default: () => 'r.schoorstra' }),
  notifications: Schema.optionalWith(NotificationSettingsSchema, { default: () => ({ enabled: false }) }),
  backgroundSync: Schema.optionalWith(BackgroundSyncSettingsSchema, { default: () => ({ enabled: false, syncIntervalSeconds: 60 * 15 }) }),
  jiraBoardId: Schema.optional(NumberFromStringOrNumber),
  mrSortOrder: Schema.optionalWith(MrSortOrderSchema, { default: () => 'updatedAt' as const }),
}))
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

const decodeSettings = Schema.decodeUnknownSync(SettingsSchema)
const encodeSettings = Schema.encodeSync(SettingsSchema)
export const defaultSettings: Settings = decodeSettings({})

const serializeSettings = (settings: Settings): string =>
  JSON.stringify(encodeSettings(settings), null, 2)

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
  try {
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

    const sanitized = jsonData !== null && typeof jsonData === 'object'
      ? Object.fromEntries(
          Object.entries(jsonData as Record<string, unknown>)
            .filter(([, v]) => v !== null)
        )
      : jsonData;

    return decodeSettings(sanitized);
  } catch (err)
  {
    console.error(err)
    throw err;
    // return defaultSettings;
  }
};

export const saveSettings = (settings: Settings): void => {
  try {
    writeFileSync(SETTINGS_FILE, serializeSettings(settings), 'utf8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const Settings = {
  toggleMonitorMergeRequest: (mrKey: MrGid): void =>
    modifySettings(settings => {
      const current = { ...settings.monitoredMergeRequests }
      if (mrKey in current) {
        delete current[mrKey]
      } else {
        current[mrKey] = { jobStates: {} }
      }
      return { ...settings, monitoredMergeRequests: current }
    }),

  clearCompletedMonitoredMrs: (): void =>
    modifySettings(settings => {
      const filtered = Object.fromEntries(
        Object.entries(settings.monitoredMergeRequests)
          .filter(([, state]) => !state.completedReason)
      ) as typeof settings.monitoredMergeRequests
      return { ...settings, monitoredMergeRequests: filtered }
    })
}

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

export const ensurePipelineJobsInSettings = (mergeRequests: MergeRequest[]) => {
  const getRepoPathsAndJobnamesFromMr = (mrs: MergeRequest[]) => {
    const mappie = new Map<string, Set<string>>();

    for(const mr of mrs) {
      let jobNames = mappie.get(mr.project.fullPath);

      if (!jobNames) {
        jobNames = new Set<string>();
        mappie.set(mr.project.fullPath, jobNames)
      }

      for (const stage of mr.pipeline.stage) {
        for (const job of stage.jobs) {
          jobNames.add(job.name);
        }
      }
    }
    return mappie;
  };

  const settings = loadSettings();
  let settingsUpdated = false;

  const jobNamesByrepoPath = getRepoPathsAndJobnamesFromMr(mergeRequests)

  for (const [repoPath, jobNames] of jobNamesByrepoPath) {
    const existingJobNamesRecord = (settings.pipelineJobImportance[repoPath] ??= {});
    const existingJobNames = Object.keys(existingJobNamesRecord);
    const missingJobNames = jobNames.values().filter(path => !existingJobNames.includes(path)).toArray();
    for (const name of missingJobNames) {
      existingJobNamesRecord[name] = 'low'
      settingsUpdated = true;
    }
  }

  if (settingsUpdated) {
    saveSettings(settings);
  }
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