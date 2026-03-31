import { Effect, FileSystem, Stream, Console } from "effect";
import * as fs from 'fs';
import * as path from 'path';
// import { getEnvFilePath, parseEnvContent, deriveMissingCredentials, type MissingCredential } from './dotenv-config';

export interface EnvCredential {
  key: string;
  displayName: string;
  description: string;
  helpUrl?: string;
  required: boolean;
  type: 'token' | 'email';
}

export const ENV_CREDENTIALS: EnvCredential[] = [
  {
    key: 'GITLAB_URL',
    displayName: 'GitLab URL',
    description: 'Base URL of your GitLab instance (e.g. https://gitlab.example.com)',
    required: false,
    type: 'token'
  },
  {
    key: 'GITLAB_TOKEN',
    displayName: 'GitLab Token',
    description: 'Personal access token for GitLab API',
    helpUrl: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
    required: false,
    type: 'token'
  },
  {
    key: 'BITBUCKET_WORKSPACE',
    displayName: 'Bitbucket Workspace',
    description: 'Workspace slug from your Bitbucket URL (bitbucket.org/{workspace})',
    required: false,
    type: 'token'
  },
  {
    key: 'BITBUCKET_EMAIL',
    displayName: 'Bitbucket Email',
    description: 'Email for Bitbucket authentication',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'email'
  },
  {
    key: 'BITBUCKET_API_TOKEN',
    displayName: 'Bitbucket API Token',
    description: 'API token for Bitbucket (App passwords)',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'token'
  },
  {
    key: 'JIRA_EMAIL',
    displayName: 'Jira Email',
    description: 'Email for Jira authentication',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'email'
  },
  {
    key: 'JIRA_API_TOKEN',
    displayName: 'Jira API Token',
    description: 'API token for Jira',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'token'
  },
  {
    key: 'JIRA_BASE_URL',
    displayName: 'Jira Base URL',
    description: 'Base URL of your Jira instance (e.g. https://yourteam.atlassian.net)',
    required: false,
    type: 'token'
  }
];

export interface MissingCredential extends EnvCredential {
  currentValue: string;
}

const isMissingValue = (value: string): boolean =>
  !value || value.trim() === '' || value.includes('TODO') || value.includes('your-');

export const parseEnvContent = (content: string): Record<string, string> =>
  content.split('\n').reduce<Record<string, string>>((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});

export const deriveMissingCredentials = (envVars: Record<string, string>): MissingCredential[] =>
  ENV_CREDENTIALS
    .map(credential => ({ ...credential, currentValue: envVars[credential.key] || '' }))
    .filter(c => isMissingValue(c.currentValue));


import { appDataPath } from '../system/app-data-dir';

export const getEnvFilePath = (): string =>
  appDataPath('.env');

const ENV_TEMPLATE = `# LazyReviewer Configuration
# Fill in the credentials for the services you want to use.
# After editing, restart LazyReviewer to pick up changes.

# ── GitLab ────────────────────────────────────────────────
# Base URL of your GitLab instance (no trailing slash)
GITLAB_URL=
# Personal access token for the GitLab API.
# Required scopes: read_api, read_user
# Create one at: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html
GITLAB_TOKEN=

# ── Bitbucket ─────────────────────────────────────────────
# Workspace slug (from your Bitbucket URL: bitbucket.org/{workspace})
BITBUCKET_WORKSPACE=
# App Password: https://id.atlassian.com/manage-profile/security/api-tokens
# Required permissions: Repositories (Read), Pull requests (Read)
BITBUCKET_EMAIL=
BITBUCKET_API_TOKEN=

# ── Jira ──────────────────────────────────────────────────
# Base URL of your Jira instance (e.g. https://yourteam.atlassian.net)
JIRA_BASE_URL=
# API token: https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_EMAIL=
JIRA_API_TOKEN=
`;

export const ensureEnvFile = Effect.fn("ensureEnvFile")(function* () {
  const envPath = getEnvFilePath();

  const exists = yield* Effect.tryPromise({
    try: () => fs.promises.access(envPath).then(() => true).catch(() => false),
    catch: () => false as const
  });

  if (!exists) {
    yield* Effect.tryPromise({
      try: () => fs.promises.writeFile(envPath, ENV_TEMPLATE, 'utf-8'),
      catch: (error) => new Error(`Failed to create .env file: ${error}`)
    });
    yield* Console.log(`[Config] Created .env template at ${envPath}`);
  }

  return envPath;
});

/** Synchronously ensure .env exists before any watchers or readers start. */
export const ensureEnvFileSync = () => {
  const envPath = getEnvFilePath();
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, ENV_TEMPLATE, 'utf-8');
  }
};

export const dotEnvFileChanges = Effect.gen(function* () {
  const effectFs = yield* FileSystem.FileSystem;
  const envPath = getEnvFilePath();

  const readAndDerive = effectFs.readFileString(envPath).pipe(
    Effect.map(content => {
      const parsed = parseEnvContent(content);
      // Keep process.env in sync — Bun only loads .env at startup
      for (const [key, value] of Object.entries(parsed)) {
        if (value) process.env[key] = value;
      }
      return deriveMissingCredentials(parsed);
    }),
    Effect.catch(() => Effect.succeed(deriveMissingCredentials({})))
  );

  const initial = yield* readAndDerive;
  yield* Console.log(`[Config] Initial check: ${initial.length} missing credentials`);

  // Watch the parent directory — some editors (vim, sed) replace files
  // atomically (write tmp + rename), which removes the original inode
  // and kills a file-level watcher. Watching the directory catches renames.
  const dir = yield* Effect.sync(() => path.dirname(envPath));
  const basename = yield* Effect.sync(() => path.basename(envPath));

  const watchStream = effectFs.watch(dir).pipe(
    Stream.filter(event => event.path === basename),
    Stream.debounce("200 millis"),
    Stream.mapEffect(() => readAndDerive),
  );

  return Stream.concat(Stream.make(initial), watchStream);
});