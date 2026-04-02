import { Effect, FileSystem, Stream, Console } from "effect";
import * as fs from 'fs';
import * as path from 'path';
import { appDataPath } from '../system/app-data-dir';

export interface Credential {
  key: string;
  displayName: string;
  description: string;
  helpUrl?: string;
  required: boolean;
  type: 'token' | 'email';
}

export const CREDENTIALS: Credential[] = [
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

export interface MissingCredential extends Credential {
  currentValue: string;
}

const CREDENTIALS_FILE = appDataPath('credentials.json');

export const getCredentialsFilePath = (): string => CREDENTIALS_FILE;

const isMissingValue = (value: string): boolean =>
  !value || value.trim() === '' || value.includes('TODO') || value.includes('your-');

const parseCredentials = (content: string): Record<string, string> => {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

/** Merge credentials file values with env var overrides into process.env */
const applyToProcessEnv = (fileValues: Record<string, string>) => {
  for (const { key } of CREDENTIALS) {
    // env var takes precedence over file
    const value = process.env[key] || fileValues[key];
    if (value) process.env[key] = value;
  }
};

export const deriveMissingCredentials = (values: Record<string, string>): MissingCredential[] =>
  CREDENTIALS
    .map(credential => ({
      ...credential,
      currentValue: process.env[credential.key] || values[credential.key] || ''
    }))
    .filter(c => isMissingValue(c.currentValue));

const CREDENTIALS_TEMPLATE: Record<string, string> = Object.fromEntries(
  CREDENTIALS.map(c => [c.key, ''])
);

export const ensureCredentialsFile = Effect.fn("ensureCredentialsFile")(function* () {
  const dir = path.dirname(CREDENTIALS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(CREDENTIALS_TEMPLATE, null, 2), 'utf-8');
    yield* Console.log(`[Config] Created credentials template at ${CREDENTIALS_FILE}`);
  }
  return CREDENTIALS_FILE;
});

/** Synchronously ensure credentials file exists and load into process.env. */
export const ensureCredentialsFileSync = () => {
  const dir = path.dirname(CREDENTIALS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(CREDENTIALS_TEMPLATE, null, 2), 'utf-8');
  }
  const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
  const values = parseCredentials(content);
  applyToProcessEnv(values);
};

export const credentialsFileChanges = Effect.gen(function* () {
  const effectFs = yield* FileSystem.FileSystem;

  const readAndDerive = effectFs.readFileString(CREDENTIALS_FILE).pipe(
    Effect.map(content => {
      const values = parseCredentials(content);
      applyToProcessEnv(values);
      return deriveMissingCredentials(values);
    }),
    Effect.catch(() => Effect.succeed(deriveMissingCredentials({})))
  );

  const initial = yield* readAndDerive;
  yield* Console.log(`[Config] Initial check: ${initial.length} missing credentials`);

  const dir = yield* Effect.sync(() => path.dirname(CREDENTIALS_FILE));
  const basename = yield* Effect.sync(() => path.basename(CREDENTIALS_FILE));

  const watchStream = effectFs.watch(dir).pipe(
    Stream.filter(event => event.path === basename),
    Stream.debounce("200 millis"),
    Stream.mapEffect(() => readAndDerive),
  );

  return Stream.concat(Stream.make(initial), watchStream);
});
