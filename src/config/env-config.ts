import { Effect, Console } from "effect";
import * as fs from 'fs';
import * as path from 'path';

export interface EnvCredential {
  key: string;
  displayName: string;
  description: string;
  placeholder: string;
  helpUrl?: string;
  required: boolean;
  type: 'token' | 'email';
}

export const ENV_CREDENTIALS: EnvCredential[] = [
  {
    key: 'GITLAB_TOKEN',
    displayName: 'GitLab Token',
    description: 'Personal access token for GitLab API',
    placeholder: 'glpat-your-gitlab-token-here',
    helpUrl: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
    required: false,
    type: 'token'
  },
  {
    key: 'BITBUCKET_EMAIL',
    displayName: 'Bitbucket Email',
    description: 'Email for Bitbucket authentication',
    placeholder: 'your.email@domain.com',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'email'
  },
  {
    key: 'BITBUCKET_API_TOKEN',
    displayName: 'Bitbucket API Token',
    description: 'API token for Bitbucket (App passwords)',
    placeholder: 'your-bitbucket-api-token-here',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'token'
  },
  {
    key: 'JIRA_EMAIL',
    displayName: 'Jira Email',
    description: 'Email for Jira authentication',
    placeholder: 'your.email@domain.com',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'email'
  },
  {
    key: 'JIRA_API_TOKEN',
    displayName: 'Jira API Token',
    description: 'API token for Jira',
    placeholder: 'your-jira-api-token-here',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    required: false,
    type: 'token'
  }
];

export interface MissingCredential extends EnvCredential {
  currentValue: string;
}

export const checkMissingCredentials = Effect.fn("checkMissingCredentials")(function* () {
  const missing: MissingCredential[] = [];

  for (const credential of ENV_CREDENTIALS) {
    const value = process.env[credential.key] || '';
    const isMissing = !value || value.trim() === '';

    if (isMissing || value.includes('TODO') || value.includes('your-')) {
      missing.push({
        ...credential,
        currentValue: value
      });
    }
  }

  yield* Console.log(`[Config] Found ${missing.length} missing or incomplete credentials`);
  return missing;
});

export const getEnvFilePath = (): string => {
  return path.join(process.cwd(), '.env');
};

export const readEnvFile = Effect.fn("readEnvFile")(function* () {
  const envPath = getEnvFilePath();

  const exists = yield* Effect.tryPromise({
    try: () => fs.promises.access(envPath).then(() => true).catch(() => false),
    catch: () => false as const
  });

  if (!exists) {
    yield* Console.log(`[Config] .env file does not exist at ${envPath}`);
    return '';
  }

  const content = yield* Effect.tryPromise({
    try: () => fs.promises.readFile(envPath, 'utf-8'),
    catch: (error) => new Error(`Failed to read .env file: ${error}`)
  });

  return content;
});

export const writeEnvFile = Effect.fn("writeEnvFile")(function* (updates: Record<string, string>) {
  const envPath = getEnvFilePath();
  const existingContent = yield* readEnvFile();

  let newContent = existingContent;
  const processedKeys = new Set<string>();

  // Update existing keys or add them if they exist but are empty
  for (const [key, value] of Object.entries(updates)) {
    if (!value || value.trim() === '') continue; // Skip empty values

    const keyPattern = new RegExp(`^${key}=.*$`, 'm');
    const commentedPattern = new RegExp(`^#\\s*${key}=.*$`, 'm');

    if (keyPattern.test(newContent)) {
      // Update existing key
      newContent = newContent.replace(keyPattern, `${key}=${value}`);
      processedKeys.add(key);
    } else if (commentedPattern.test(newContent)) {
      // Uncomment and update
      newContent = newContent.replace(commentedPattern, `${key}=${value}`);
      processedKeys.add(key);
    }
  }

  // Add new keys that weren't in the file
  for (const [key, value] of Object.entries(updates)) {
    if (!value || value.trim() === '' || processedKeys.has(key)) continue;

    const credential = ENV_CREDENTIALS.find(c => c.key === key);
    const comment = credential ? `\n# ${credential.description}\n` : '\n';
    newContent += `${comment}${key}=${value}\n`;
  }

  yield* Effect.tryPromise({
    try: () => fs.promises.writeFile(envPath, newContent, 'utf-8'),
    catch: (error) => new Error(`Failed to write .env file: ${error}`)
  });

  yield* Console.log(`[Config] Updated .env file at ${envPath}`);

  // Update process.env in the current process
  for (const [key, value] of Object.entries(updates)) {
    if (value && value.trim() !== '') {
      process.env[key] = value;
    }
  }
});
