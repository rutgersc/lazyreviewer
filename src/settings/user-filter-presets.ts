import { Effect, Schema, Stream, Console } from 'effect';
import { FileSystem } from '@effect/platform';
import { DEFAULT_USERS, DEFAULT_GROUPS } from '../data/default-users-and-groups';

const USER_SETTINGS_FILE = 'lazyreviewer-settings-users.json';

const SettingsUserSchema = Schema.mutable(Schema.Struct({
  userId: Schema.String,
  gitlab: Schema.optional(Schema.String),
  bitbucket: Schema.optional(Schema.String),
  jira: Schema.optional(Schema.String),
}))

const SettingsGroupSchema = Schema.mutable(Schema.Struct({
  name: Schema.String,
  id: Schema.String,
  users: Schema.mutable(Schema.Array(Schema.String)),
  groups: Schema.mutable(Schema.Array(Schema.String)),
}))

export const UserSettingsSchema = Schema.mutable(Schema.Struct({
  users: Schema.optionalWith(Schema.mutable(Schema.Array(SettingsUserSchema)), { default: () => [...DEFAULT_USERS] }),
  userGroups: Schema.optionalWith(Schema.mutable(Schema.Array(SettingsGroupSchema)), { default: () => [...DEFAULT_GROUPS] }),
}))
export type UserSettings = Schema.Schema.Type<typeof UserSettingsSchema>

const decodeUserSettings = Schema.decodeUnknownSync(UserSettingsSchema)
const encodeUserSettings = Schema.encodeSync(UserSettingsSchema)
export const defaultUserSettings: UserSettings = decodeUserSettings({})

const serializeUserSettings = (settings: UserSettings): string =>
  JSON.stringify(encodeUserSettings(settings), null, 2)

export class UserSettingsService extends Effect.Service<UserSettingsService>()("UserSettingsService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const load = Effect.gen(function* () {
      const exists = yield* fs.exists(USER_SETTINGS_FILE);
      if (!exists) {
        const initial = decodeUserSettings({});
        yield* fs.writeFileString(USER_SETTINGS_FILE, serializeUserSettings(initial));
        return initial;
      }
      const content = yield* fs.readFileString(USER_SETTINGS_FILE);
      return decodeUserSettings(JSON.parse(content));
    });

    const save = (settings: UserSettings) =>
      fs.writeFileString(USER_SETTINGS_FILE, serializeUserSettings(settings));

    const modify = (f: (s: UserSettings) => UserSettings) =>
      load.pipe(Effect.flatMap(current => save(f(current))));

    const initial = yield* load;

    const watchStream = Stream.concat(
      Stream.make(initial),
      fs.watch(USER_SETTINGS_FILE).pipe(
        Stream.debounce("100 millis"),
        Stream.mapEffect(() => load.pipe(
          Effect.catchAll((error) =>
            Console.error("Failed to read user settings:", error).pipe(
              Effect.as(defaultUserSettings)
            )
          )
        )),
        Stream.changes,
      )
    );

    return { load, save, modify, watchStream } as const;
  })
}) {}
