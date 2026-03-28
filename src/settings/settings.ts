import { Effect, Schema, SchemaGetter, ServiceMap, Stream, Console } from 'effect';
import type { Struct as Struct_ } from 'effect/Schema';
import { FileSystem } from '@effect/platform';
import type { MergeRequest } from '../mergerequests/mergerequest-schema';
import { MrGid } from '../domain/identifiers';
import { PipelineJobSchema } from '../domain/merge-request-schema';

const SETTINGS_FILE = 'lazyreviewer-settings.json';
const DEFAULT_SETTINGS_FILE = 'default-settings.json';

// v4: Schema.mutable only works on arrays. For structs, use mapFields with mutableKey.
const mutableStruct = <F extends Struct_.Fields>(fields: F) =>
  Schema.Struct(fields).mapFields(
    (fs) => Object.fromEntries(Object.entries(fs).map(([k, v]) => [k, Schema.mutableKey(v)])) as { [K in keyof F]: Schema.mutableKey<F[K]> }
  );

// Schema for coercing string|number to number (for user-edited JSON)
const NumberFromStringOrNumber = Schema.Union([Schema.Number, Schema.String]).pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((input) => typeof input === 'string' ? Number(input) : input),
    encode: SchemaGetter.transform((n) => n)
  })
)

const JobImportanceSchema = Schema.Literals(['ignore', 'low', 'monitored'])
export type JobImportance = Schema.Schema.Type<typeof JobImportanceSchema>

const JobImportanceWithMigration = Schema.Union([Schema.Literals(['ignore', 'low', 'monitored', 'high', 'hidden']), Schema.String]).pipe(
  Schema.decodeTo(JobImportanceSchema, {
    decode: SchemaGetter.transform((input) => {
      if (input === 'high') return 'monitored' as const;
      if (input === 'hidden') return 'ignore' as const;
      if (input === 'ignore' || input === 'low' || input === 'monitored') return input;
      return 'low' as const;
    }),
    encode: SchemaGetter.transform((output) => output)
  })
)

const MrSortOrderSchema = Schema.Literals(['updatedAt', 'createdAt'])
export type MrSortOrder = Schema.Schema.Type<typeof MrSortOrderSchema>

const NotificationSettingsSchema = mutableStruct({
  enabled: Schema.Boolean,
  lastProcessedEventId: Schema.optional(Schema.String),
})
export type NotificationSettings = Schema.Schema.Type<typeof NotificationSettingsSchema>

const BackgroundSyncSettingsSchema = mutableStruct({
  enabled: Schema.Boolean,
  syncIntervalSeconds: Schema.Number,
  scalingFactorHours: Schema.Number.pipe(Schema.withDecodingDefaultKey(() => 24)),
  lastRefreshTimestamp: Schema.optional(Schema.String),
  pageFetchTimestamps: Schema.Record(Schema.String, Schema.mutable(Schema.Array(Schema.String))).pipe(
    Schema.withDecodingDefaultKey(() => ({}))
  ),
})
export type BackgroundSyncSettings = Schema.Schema.Type<typeof BackgroundSyncSettingsSchema>

// Repository path configuration schema
const RepositoryPathConfigSchema = mutableStruct({
  localPath: Schema.String,
  remoteName: Schema.String.pipe(Schema.withDecodingDefaultKey(() => 'origin'))
})
export type RepositoryPathConfig = Schema.Schema.Type<typeof RepositoryPathConfigSchema>

// Transform for backward compatibility: string -> object, object -> object
const RepositoryPathConfigWithMigration = Schema.Union([Schema.String, RepositoryPathConfigSchema]).pipe(
  Schema.decodeTo(RepositoryPathConfigSchema, {
    decode: SchemaGetter.transform((input) => typeof input === 'string'
      ? { localPath: input, remoteName: 'origin' }
      : input),
    encode: SchemaGetter.transform((output) => ({ localPath: output.localPath, remoteName: output.remoteName ?? 'origin' }))
  })
)

const MonitoredMrStateSchema = mutableStruct({
  pipelineIid: Schema.optional(Schema.String),
  jobStates: Schema.Record(Schema.String, PipelineJobSchema.fields.status).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  lastCommit: Schema.optional(Schema.String),
})
export type MonitoredMrState = Schema.Schema.Type<typeof MonitoredMrStateSchema>

export const SettingsSchema = mutableStruct({
  repositoryPaths: Schema.Record(Schema.String, RepositoryPathConfigWithMigration).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  repositoryColors: Schema.Record(Schema.String, Schema.String).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  ignoredMergeRequests: Schema.mutable(Schema.Array(Schema.String)).pipe(Schema.withDecodingDefaultKey(() => [])),
  seenMergeRequests: Schema.mutable(Schema.Array(Schema.String)).pipe(Schema.withDecodingDefaultKey(() => [])),
  monitoredMergeRequests: Schema.Record(Schema.String.pipe(Schema.fromBrand("MrGid", MrGid)), MonitoredMrStateSchema).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  projectMonitoredJobs: Schema.Record(Schema.String, Schema.mutable(Schema.Array(Schema.String))).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  pipelineJobImportance: Schema.Record(Schema.String, Schema.Record(Schema.String, JobImportanceWithMigration)).pipe(Schema.withDecodingDefaultKey(() => ({}))),
  repoSelection: Schema.mutable(Schema.Array(Schema.String)).pipe(Schema.withDecodingDefaultKey(() => [])),
  userFilterUsernames: Schema.mutable(Schema.Array(Schema.String)).pipe(Schema.withDecodingDefaultKey(() => [])),
  userFilterGroupIds: Schema.mutable(Schema.Array(Schema.String)).pipe(Schema.withDecodingDefaultKey(() => [])),
  selectedUserSelectionEntryId: Schema.optional(Schema.String),
  currentUser: Schema.optional(Schema.String),
  notifications: NotificationSettingsSchema.pipe(Schema.withDecodingDefaultKey(() => ({ enabled: false }))),
  backgroundSync: BackgroundSyncSettingsSchema.pipe(Schema.withDecodingDefaultKey(() => ({ enabled: false, syncIntervalSeconds: 500, scalingFactorHours: 24, pageFetchTimestamps: {} }))),
  jiraBoardId: Schema.optional(NumberFromStringOrNumber),
  mrSortOrder: MrSortOrderSchema.pipe(Schema.withDecodingDefaultKey(() => 'createdAt' as const)),
  appView: Schema.Literals(['review', 'focus']).pipe(Schema.withDecodingDefaultKey(() => 'review' as const)),
  factsViewStyle: Schema.Literals(['chronological', 'grouped']).pipe(Schema.withDecodingDefaultKey(() => 'chronological' as const)),
  sprintFilterId: Schema.optional(Schema.Number),
  sprintFilterName: Schema.optional(Schema.String),
  factsSelectionActive: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(() => false)),
})
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

export class SettingsService extends ServiceMap.Service<SettingsService>()("SettingsService", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const loadDefaultOverrides = Effect.gen(function* () {
      const exists = yield* fs.exists(DEFAULT_SETTINGS_FILE);
      if (!exists) return {};
      const content = yield* fs.readFileString(DEFAULT_SETTINGS_FILE);
      return JSON.parse(content) as Record<string, unknown>;
    }).pipe(
      Effect.catch(() => Effect.succeed({} as Record<string, unknown>))
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
          Effect.catch((error) =>
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
