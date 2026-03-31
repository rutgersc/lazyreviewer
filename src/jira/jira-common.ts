import { Config, Data, Effect, Redacted } from "effect";

export class JiraApiError extends Data.TaggedError("JiraApiError")<{
  cause: unknown;
  message: string;
}> {}

export const getAuthToken = Effect.gen(function* () {
  const fromEmailAndToken = Effect.gen(function* () {
    const email = yield* Config.string("JIRA_EMAIL")
    const token = yield* Config.redacted("JIRA_API_TOKEN")
    return Buffer.from(`${email}:${Redacted.value(token)}`).toString('base64')
  })
  return yield* Effect.catch(fromEmailAndToken, () => Effect.gen(function* () {
    return yield* Config.string("JIRA_API_TOKEN_BASE64")
  }))
})

export const getJiraBaseUrl = (): string => {
  const url = process.env.JIRA_BASE_URL;
  if (!url) throw new Error("JIRA_BASE_URL not configured. Set it in .env");
  return url;
};

export const JiraBaseUrl = Config.string("JIRA_BASE_URL")

export const JIRA_ISSUE_FIELDS = [
  'summary',
  'parent',
  'status',
  'assignee',
  'priority',
  'issuetype',
  'created',
  'updated',
  'comment',
  'subtasks',
] as const;
