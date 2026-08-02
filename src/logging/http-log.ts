// One line per outgoing request. Wraps fetch rather than using graphql-request's middleware so the
// same instrumentation covers GraphQL and the REST calls (job traces, Jira, Bitbucket, onboarding).

const shortUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return url
  }
}

const compactVariables = (variables: unknown): string =>
  variables && typeof variables === 'object'
    ? Object.entries(variables as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => Array.isArray(value) ? `${key}=[${value.length}]` : `${key}=${String(value).slice(0, 48)}`)
        .join(' ')
    : ''

// A GraphQL POST body carries the operation name and variables; that is the only way to tell one
// /api/graphql request from another.
const describeGraphqlBody = (body: unknown): string => {
  if (typeof body !== 'string') return ''
  try {
    const parsed = JSON.parse(body) as { query?: string; operationName?: string; variables?: unknown }
    if (!parsed.query) return ''
    return [parsed.operationName ?? 'anonymous', compactVariables(parsed.variables)].filter(Boolean).join(' ')
  } catch {
    return ''
  }
}

const formatDuration = (ms: number): string => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`

const formatSize = (response: Response): string => {
  const contentLength = response.headers.get('content-length')
  return contentLength ? `, ${(Number(contentLength) / 1024).toFixed(1)} KB` : ''
}

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

const urlOf = (input: FetchInput): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

export const loggedFetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
  const startedAt = performance.now()
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
  const target = shortUrl(urlOf(input))
  const detail = describeGraphqlBody(init?.body)
  const label = `${method} ${target}${detail ? ` ${detail}` : ''}`

  try {
    const response = await fetch(input, init)
    console.log(`[HTTP] ${label} → ${response.status} in ${formatDuration(performance.now() - startedAt)}${formatSize(response)}`)
    return response
  } catch (cause) {
    console.log(`[HTTP] ${label} → FAILED in ${formatDuration(performance.now() - startedAt)}: ${cause}`)
    throw cause
  }
}
