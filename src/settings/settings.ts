import { Effect, Schema, Stream, Console } from 'effect';
import { FileSystem } from '@effect/platform';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { MrGid } from '../domain/identifiers';
import { PipelineJobSchema } from '../domain/merge-request-schema';

const SETTINGS_FILE = 'lazygitlab-settings.json';
const DEFAULT_SETTINGS_FILE = 'default-settings.json';

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
  scalingFactorHours: Schema.optionalWith(Schema.Number, { default: () => 24 }),
  lastRefreshTimestamp: Schema.optional(Schema.String),
  pageFetchTimestamps: Schema.optionalWith(
    Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Array(Schema.String)) })),
    { default: () => ({}) }
  ),
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
  repoSelection: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  userFilterUsernames: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  userFilterGroupIds: Schema.optionalWith(Schema.mutable(Schema.Array(Schema.String)), { default: () => [] }),
  selectedUserSelectionEntryId: Schema.optional(Schema.String),
  currentUser: Schema.optional(Schema.String),
  notifications: Schema.optionalWith(NotificationSettingsSchema, { default: () => ({ enabled: false }) }),
  backgroundSync: Schema.optionalWith(BackgroundSyncSettingsSchema, { default: () => ({ enabled: false, syncIntervalSeconds: 500, scalingFactorHours: 24, pageFetchTimestamps: {} }) }),
  jiraBoardId: Schema.optional(NumberFromStringOrNumber),
  mrSortOrder: Schema.optionalWith(MrSortOrderSchema, { default: () => 'createdAt' as const }),
  appView: Schema.optionalWith(Schema.Literal('review', 'focus'), { default: () => 'review' as const }),
  factsViewStyle: Schema.optionalWith(Schema.Literal('chronological', 'grouped'), { default: () => 'chronological' as const }),
  sprintFilterId: Schema.optional(Schema.Number),
  sprintFilterName: Schema.optional(Schema.String),
  factsSelectionActive: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}))
export type Settings = Schema.Schema.Type<typeof SettingsSchema>

const decodeSettings = Schema.decodeUnknownSync(SettingsSchema)
const encodeSettings = Schema.encodeSync(SettingsSchema)
export const defaultSettings: Settings = decodeSettings({})

const serializeSettings = (settings: Settings): string =>
  JSON.stringify(encodeSettings(settings), null, 2)

const sanitizeJson = (jsonData: unknown) =>
  jsonData !== null && typeof jsonData === 'object'
    ? Object.fromEntries(
        Object.entries(jsonData as Record<string, unknown>)
          .filter(([, v]) => v !== null)
      )
    : jsonData;

const getRepoPathsAndJobnames = (mrs: MergeRequest[]) => {
  const result = new Map<string, Set<string>>();
  for (const mr of mrs) {
    const jobNames = result.get(mr.project.fullPath) ?? new Set<string>();
    if (!result.has(mr.project.fullPath)) result.set(mr.project.fullPath, jobNames);
    for (const stage of mr.pipeline.stage) {
      for (const job of stage.jobs) {
        jobNames.add(job.name);
      }
    }
  }
  return result;
};

export class SettingsService extends Effect.Service<SettingsService>()("SettingsService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const loadDefaultOverrides = Effect.gen(function* () {
      const exists = yield* fs.exists(DEFAULT_SETTINGS_FILE);
      if (!exists) return {};
      const content = yield* fs.readFileString(DEFAULT_SETTINGS_FILE);
      return JSON.parse(content) as Record<string, unknown>;
    }).pipe(
      Effect.catchAll(() => Effect.succeed({} as Record<string, unknown>))
    );

    const load = Effect.gen(function* () {
      const exists = yield* fs.exists(SETTINGS_FILE);
      if (!exists) {
        const overrides = yield* loadDefaultOverrides;
        const initial = decodeSettings(overrides);
        yield* fs.writeFileString(SETTINGS_FILE, serializeSettings(initial));
        return initial;
      }
      const content = yield* fs.readFileString(SETTINGS_FILE);
      return decodeSettings(sanitizeJson(JSON.parse(content)));
    });

    const save = (settings: Settings) =>
      fs.writeFileString(SETTINGS_FILE, serializeSettings(settings));

    const modify = (f: (s: Settings) => Settings) =>
      load.pipe(Effect.flatMap(current => save(f(current))));

    const ensurePipelineJobsInSettings = (mergeRequests: MergeRequest[]) =>
      Effect.gen(function* () {
        const settings = yield* load;
        const jobNamesByRepoPath = getRepoPathsAndJobnames(mergeRequests);
        let settingsUpdated = false;

        for (const [repoPath, jobNames] of jobNamesByRepoPath) {
          const existingRecord = (settings.pipelineJobImportance[repoPath] ??= {});
          const existingKeys = Object.keys(existingRecord);
          for (const name of jobNames) {
            if (!existingKeys.includes(name)) {
              existingRecord[name] = 'low';
              settingsUpdated = true;
            }
          }
        }

        if (settingsUpdated) {
          yield* save(settings);
        }
      });

    // Ensure file exists and get initial settings
    const initial = yield* load;

    const watchStream = Stream.concat(
      Stream.make(initial),
      fs.watch(SETTINGS_FILE).pipe(
        Stream.debounce("100 millis"),
        Stream.mapEffect(() => load.pipe(
          Effect.catchAll((error) =>
            Console.error("Failed to read settings:", error).pipe(
              Effect.as(defaultSettings)
            )
          )
        )),
        Stream.changes,
      )
    );

    return { load, save, modify, watchStream, ensurePipelineJobsInSettings } as const;
  })
}) {}
